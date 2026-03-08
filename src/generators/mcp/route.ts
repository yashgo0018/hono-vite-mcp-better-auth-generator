import type { ProjectConfig } from "../../types";

export function generateMcpRoute(config: ProjectConfig): string {
	const hasOAuth = config.includeMcpOAuth;
	const hasDB = config.includeDatabase;
	const hasOrgs = config.includeOrganizations;

	const oauthImports = hasOAuth
		? `import { verifyOAuthAccessToken, getSessionCookieForMcpBearer } from "../mcp/auth";`
		: "";

	const dbImports = hasDB
		? `import { createDb, schema } from "@${config.name}/db";
import { eq } from "drizzle-orm";
import { resolveDatabaseUrl } from "../lib/db-url";`
		: "";

	// Auth block at start of route handler
	const authBlock = hasOAuth
		? `	const base = c.env.API_ORIGIN;
	const resourceMetadataUrl = \`\${base}/.well-known/oauth-protected-resource\`;
	const bearerToken = c.req.header("Authorization")?.replace(/^Bearer /, "").trim();

	if (!bearerToken) {
		c.header("WWW-Authenticate", \`Bearer resource_metadata="\${resourceMetadataUrl}"\`);
		c.header("Access-Control-Expose-Headers", "WWW-Authenticate");
		return c.json({ error: "Unauthorized" }, 401);
	}

	const issuer = \`\${base}/api/auth\`;
	const audience = \`\${base}/mcp\`;
	const verified = await verifyOAuthAccessToken({ env: c.env, accessToken: bearerToken, issuer, audience });
	if (!verified) {
		c.header("WWW-Authenticate", \`Bearer resource_metadata="\${resourceMetadataUrl}"\`);
		c.header("Access-Control-Expose-Headers", "WWW-Authenticate");
		return c.json({ error: "Unauthorized" }, 401);
	}`
		: `	// No OAuth - bearer token is used as userId for development
	const bearerToken = c.req.header("Authorization")?.replace(/^Bearer /, "").trim();
	const verified = { userId: bearerToken ?? "anonymous" };`;

	// Inside CallTool handler: fetch session, get cookie, build client
	const callToolSessionFetch = hasDB
		? `		const db = createDb(resolveDatabaseUrl(env));
		const [row] = await db
			.select()
			.from(schema.mcpSession)
			.where(eq(schema.mcpSession.id, sessionId))
			.limit(1);

		if (!row) {
			return { content: [{ type: "text", text: "Invalid or expired session." }], isError: true };
		}

		await db.update(schema.mcpSession).set({ updatedAt: new Date() })
			.where(eq(schema.mcpSession.id, sessionId));

		const session: SessionInfo = {
			userId: row.userId,${hasOrgs ? "\n\t\t\torganizationId: row.defaultOrganizationId ?? undefined," : ""}
		};`
		: `		const entry = sessionToServer.get(sessionId);
		if (!entry) {
			return { content: [{ type: "text", text: "Invalid or expired session." }], isError: true };
		}

		const session: SessionInfo = { userId: entry.userId };`;

	const callToolCookieBlock = hasOAuth
		? `
		const effectiveHeaders: HeaderRecord = { ...requestHeaders };
		if (!getHeader(effectiveHeaders, "cookie")) {
			const bearer = getBearerToken(effectiveHeaders);
			if (bearer) {
				const cookieStr = await getSessionCookieForMcpBearer({
					env,
					accessToken: bearer,
					issuer: \`\${env.API_ORIGIN}/api/auth\`,
					audience: \`\${env.API_ORIGIN}/mcp\`,
				});
				if (cookieStr) effectiveHeaders.cookie = cookieStr;
			}
		}
		const clientHeaders: Record<string, string> = {};
		if (effectiveHeaders.cookie) clientHeaders.cookie = effectiveHeaders.cookie as string;
		if (effectiveHeaders.authorization) clientHeaders.authorization = effectiveHeaders.authorization as string;`
		: `

		const clientHeaders: Record<string, string> = {};
		const bearer = getBearerToken(requestHeaders);
		if (bearer) clientHeaders.authorization = \`Bearer \${bearer}\`;`;

	const orgPersist = hasDB && hasOrgs
		? `
		if (session.organizationId) {
			await db.update(schema.mcpSession)
				.set({ defaultOrganizationId: session.organizationId })
				.where(eq(schema.mcpSession.id, sessionId));
		}`
		: "";

	const persistSession = hasDB
		? `
		const db = createDb(resolveDatabaseUrl(c.env));
		await db.insert(schema.mcpSession).values({ id: sessionId, userId: verified.userId });`
		: "";

	const deleteDbRow = hasDB
		? `
		const db = createDb(resolveDatabaseUrl(c.env));
		await db.delete(schema.mcpSession).where(eq(schema.mcpSession.id, sessionId));`
		: "";

	const cleanupCall = hasDB
		? "await cleanupExpiredSessions(env);"
		: "cleanupExpiredSessions();";

	return `import {
	CallToolRequestSchema,
	ErrorCode,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	McpError,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
${oauthImports}
${dbImports}
import { cleanupExpiredSessions, sessionToServer } from "../mcp/session";
import { executeTool, formatError } from "../mcp/tool-execution";
import { tools } from "../mcp/tools";
import { resources } from "../mcp/resources";
import { McpApiClient } from "../mcp/api-client";
import type { Bindings } from "../env";
import type { HeaderRecord, SessionInfo } from "../mcp/types";
import { SESSION_HEADER } from "../mcp/types";
import { getBearerToken, getHeader, getSessionIdFromHeaders, isRecord } from "../mcp/utils";

function createMcpServer(env: Bindings): McpServer {
	const mcpServer = new McpServer(
		{ name: "${config.name} MCP Server", version: "1.0.0" },
		{ capabilities: { tools: {}, resources: {} } },
	);
	const server = mcpServer.server;

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map(({ name, description, inputSchema, annotations }) => ({
			name,
			description,
			inputSchema,
			annotations,
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
		${cleanupCall}

		const requestHeaders = (extra?.requestInfo?.headers ?? {}) as HeaderRecord;
		const sessionId = getSessionIdFromHeaders(requestHeaders);

		if (!sessionId) {
			return { content: [{ type: "text", text: "Missing mcp-session-id. Call initialize first." }], isError: true };
		}

		${callToolSessionFetch}
		${callToolCookieBlock}

		const args = isRecord(request.params.arguments) ? request.params.arguments : {};
		const client = new McpApiClient(env.API_ORIGIN, clientHeaders);

		try {
			const result = await executeTool(request.params.name, args, session, client);
			${orgPersist}
			return result;
		} catch (error) {
			return { content: [{ type: "text", text: formatError(request.params.name, error) }], isError: true };
		}
	});

	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: Object.entries(resources).map(([uri, resource]) => ({
			uri,
			name: resource.name,
			mimeType: resource.mimeType,
		})),
	}));

	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		const resource = resources[request.params.uri as keyof typeof resources];
		if (!resource) {
			throw new McpError(ErrorCode.InvalidRequest, \`Unknown resource: \${request.params.uri}\`);
		}
		return {
			contents: [{ uri: request.params.uri, mimeType: resource.mimeType, text: await resource.getContent() }],
		};
	});

	return mcpServer;
}

export const mcpRoutes = new Hono<{ Bindings: Bindings }>()
	.all("/", async (c) => {
		${authBlock}

		if (c.req.method !== "POST") {
			return c.json({ error: "Method not allowed" }, 405);
		}

		const maybeBody = await c.req.raw.clone().json().catch(() => undefined);
		const body = isRecord(maybeBody) ? maybeBody : undefined;

		if (body?.method === "initialize") {
			const server = createMcpServer(c.env);
			const transport = new StreamableHTTPTransport({
				sessionIdGenerator: () => crypto.randomUUID(),
			});
			await server.connect(transport);
			const response = await transport.handleRequest(c, body);
			const sessionId = response?.headers?.get(SESSION_HEADER);
			if (sessionId) {
				sessionToServer.set(sessionId, { server, transport });
				${persistSession}
			}
			return response;
		}

		const sessionId =
			c.req.header(SESSION_HEADER) ?? c.req.header("Mcp-Session-Id") ?? undefined;
		if (!sessionId) {
			return c.json(
				{ jsonrpc: "2.0", error: { code: -32600, message: "Missing mcp-session-id" }, id: null },
				400,
			);
		}

		const entry = sessionToServer.get(sessionId);
		if (!entry) {
			return c.json(
				{ jsonrpc: "2.0", error: { code: -32600, message: "Unknown or expired session. Call initialize again." }, id: (body as any)?.id ?? null },
				401,
			);
		}

		return entry.transport.handleRequest(c, body);
	})

	.delete("/:sessionId", async (c) => {
		const sessionId = c.req.param("sessionId");
		sessionToServer.delete(sessionId);
		${deleteDbRow}
		return c.json({ message: "Session deleted" });
	});
`;
}
