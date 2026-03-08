import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateMcpBackend(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	if (!config.includeMcp) return;

	const backendPath = join(projectPath, "apps/backend");

	// Create MCP directory structure
	createDirectory(join(backendPath, "src/mcp"));

	// Generate MCP auth utilities
	const authTs = generateMcpAuth(config);
	writeFile(join(backendPath, "src/mcp/auth.ts"), authTs);

	// Generate MCP session management
	const sessionTs = generateMcpSession(config);
	writeFile(join(backendPath, "src/mcp/session.ts"), sessionTs);

	// Generate MCP tools
	const toolsTs = generateMcpTools(config);
	writeFile(join(backendPath, "src/mcp/tools.ts"), toolsTs);

	// Generate MCP tool execution dispatcher
	const toolExecutionTs = generateMcpToolExecution(config);
	writeFile(join(backendPath, "src/mcp/tool-execution.ts"), toolExecutionTs);

	// Generate MCP API client
	const apiClientTs = generateMcpApiClient(config);
	writeFile(join(backendPath, "src/mcp/api-client.ts"), apiClientTs);

	// Generate MCP resources
	const resourcesTs = generateMcpResources(config);
	writeFile(join(backendPath, "src/mcp/resources.ts"), resourcesTs);

	// Generate MCP types
	const typesTs = generateMcpTypes(config);
	writeFile(join(backendPath, "src/mcp/types.ts"), typesTs);

	// Generate MCP utils
	const utilsTs = generateMcpUtils();
	writeFile(join(backendPath, "src/mcp/utils.ts"), utilsTs);

	// Generate MCP route handler
	const mcpRouteTs = generateMcpRoute(config);
	writeFile(join(backendPath, "src/routes/mcp.ts"), mcpRouteTs);

	if (config.includeMcpOAuth) {
		// Generate OAuth metadata endpoints
		const oauthRouteTs = generateOAuthRoute(config);
		writeFile(join(backendPath, "src/routes/oauth.ts"), oauthRouteTs);
	}
}

function generateMcpAuth(config: ProjectConfig): string {
	if (!config.includeMcpOAuth) {
		return `// MCP authentication utilities
export async function verifyMcpAccess(): Promise<boolean> {
	// TODO: Implement MCP access verification
	return true;
}
`;
	}

	return `import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { createAuthClient } from "better-auth/client";
${config.includeDatabase ? `import { createDb, schema } from "@${config.name}/db";
import { desc, eq } from "drizzle-orm";
import { resolveDatabaseUrl } from "../lib/db-url";` : ""}
import { getAuth } from "../auth";
import type { Bindings } from "../env";

/** Verify OAuth 2.1 access token and return userId, or null if invalid. */
export async function verifyOAuthAccessToken({
	env,
	accessToken,
	issuer,
	audience,
}: {
	env: Bindings;
	accessToken: string;
	issuer: string;
	audience: string;
}): Promise<{ userId: string } | null> {
	const auth = getAuth(env);
	const serverClient = createAuthClient({
		plugins: [oauthProviderResourceClient(auth)],
	});
	try {
		const payload = await serverClient.verifyAccessToken(accessToken, {
			verifyOptions: { issuer, audience },
		});
		const sub = payload?.sub;
		if (typeof sub !== "string") return null;
		return { userId: sub };
	} catch {
		return null;
	}
}

async function signSessionCookieValue(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
	const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return encodeURIComponent(\`\${value}.\${base64Signature}\`);
}

/** Convert an OAuth Bearer token into a Better Auth session cookie. */
export async function getSessionCookieForMcpBearer({
	env,
	accessToken,
	issuer,
	audience,
}: {
	env: Bindings;
	accessToken: string;
	issuer: string;
	audience: string;
}): Promise<string | null> {
	const verified = await verifyOAuthAccessToken({ env, accessToken, issuer, audience });
	if (!verified?.userId) return null;
${config.includeDatabase ? `
	const db = createDb(resolveDatabaseUrl(env));
	const [authSession] = await db
		.select({ token: schema.session.token })
		.from(schema.session)
		.where(eq(schema.session.userId, verified.userId))
		.orderBy(desc(schema.session.updatedAt))
		.limit(1);

	if (!authSession?.token) return null;

	const signedValue = await signSessionCookieValue(authSession.token, env.BETTER_AUTH_SECRET);
	return \`better-auth.session_token=\${signedValue}\`;
` : `
	// Without a database, fall back to empty (API calls will use Authorization header)
	return null;
`}}
`;
}

function generateMcpSession(config: ProjectConfig): string {
	if (config.includeDatabase) {
		return `import type { StreamableHTTPTransport } from "@hono/mcp";
import { createDb, schema } from "@${config.name}/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lt } from "drizzle-orm";
import type { Bindings } from "../env";
import { resolveDatabaseUrl } from "../lib/db-url";
import { SESSION_TTL_MS } from "./types";

export const sessionToServer = new Map<
	string,
	{ server: McpServer; transport: StreamableHTTPTransport }
>();

export async function cleanupExpiredSessions(env: Bindings): Promise<void> {
	const db = createDb(resolveDatabaseUrl(env));
	const cutoff = new Date(Date.now() - SESSION_TTL_MS);
	const expired = await db
		.select({ id: schema.mcpSession.id })
		.from(schema.mcpSession)
		.where(lt(schema.mcpSession.updatedAt, cutoff));
	for (const row of expired) {
		sessionToServer.delete(row.id);
	}
	if (expired.length > 0) {
		await db.delete(schema.mcpSession).where(lt(schema.mcpSession.updatedAt, cutoff));
	}
}
`;
	}

	return `import type { StreamableHTTPTransport } from "@hono/mcp";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SESSION_TTL_MS } from "./types";

export interface McpSessionEntry {
	server: McpServer;
	transport: StreamableHTTPTransport;
	userId: string;
	lastActivity: number;
}

export const sessionToServer = new Map<string, McpSessionEntry>();

export function cleanupExpiredSessions(): void {
	const cutoff = Date.now() - SESSION_TTL_MS;
	for (const [id, entry] of sessionToServer) {
		if (entry.lastActivity < cutoff) sessionToServer.delete(id);
	}
}
`;
}

function generateMcpTools(config: ProjectConfig): string {
	return `// Tool definitions for the MCP protocol (JSON Schema format).
// Execution logic lives in tool-execution.ts.
export const tools = [
	{
		name: "get_user",
		description: "Get the current authenticated user's information",
		inputSchema: { type: "object" as const, properties: {} },
		annotations: { readOnlyHint: true, idempotentHint: true },
	},
	{
		name: "list_records",
		description: "List example records. Customize this tool for your domain.",
		inputSchema: {
			type: "object" as const,
			properties: {
				limit: { type: "number", description: "Maximum number of records to return (default 10)" },
			},
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "create_record",
		description: "Create a new record. Customize this tool for your domain.",
		inputSchema: {
			type: "object" as const,
			properties: {
				name: { type: "string", description: "Record name (required)" },
				description: { type: "string", description: "Optional description" },
			},
			required: ["name"],
		},
		annotations: { destructiveHint: false },
	},
${
	config.includeOrganizations
		? `	{
		name: "list_organizations",
		description: "List organizations the current user belongs to",
		inputSchema: { type: "object" as const, properties: {} },
		annotations: { readOnlyHint: true },
	},
	{
		name: "switch_organization",
		description: "Set the default organization context for this MCP session",
		inputSchema: {
			type: "object" as const,
			properties: {
				organization_id: { type: "string", description: "Organization ID to switch to" },
			},
			required: ["organization_id"],
		},
		annotations: { idempotentHint: true },
	},
`
		: ""
}];
`;
}

function generateMcpToolExecution(config: ProjectConfig): string {
	return `import type { McpApiClient } from "./api-client";
import type { JsonRecord, SessionInfo, ToolResult } from "./types";
import { asString, textResult } from "./utils";

export function formatError(toolName: string, error: unknown): string {
	if (error instanceof Error) return \`Tool '\${toolName}' failed: \${error.message}\`;
	return \`Tool '\${toolName}' failed: \${String(error)}\`;
}
${
	config.includeOrganizations
		? `
export function resolveOrganizationId(args: JsonRecord, session: SessionInfo): string {
	const explicit = asString(args.organization_id);
	if (explicit) {
		session.organizationId = explicit;
		return explicit;
	}
	if (session.organizationId) return session.organizationId;
	throw new Error(
		"No organization selected. Use list_organizations then switch_organization to set a default.",
	);
}
`
		: ""
}
export async function executeTool(
	toolName: string,
	args: JsonRecord,
	session: SessionInfo,
	client: McpApiClient,
): Promise<ToolResult> {
	switch (toolName) {
		case "get_user": {
			const user = await client.get(\`/api/users/\${session.userId}\`);
			return textResult(JSON.stringify(user, null, 2), user);
		}

		case "list_records": {
			const limit = typeof args.limit === "number" ? args.limit : 10;
			const records = await client.get(\`/api/records?limit=\${limit}\`);
			return textResult(JSON.stringify(records, null, 2), records);
		}

		case "create_record": {
			const name = asString(args.name);
			if (!name) throw new Error("name is required");
			const record = await client.post("/api/records", {
				name,
				description: asString(args.description),
			});
			return textResult(\`Record created: \${JSON.stringify(record, null, 2)}\`, record);
		}
${
	config.includeOrganizations
		? `
		case "list_organizations": {
			const orgs = await client.get("/api/organizations");
			return textResult(JSON.stringify(orgs, null, 2), orgs);
		}

		case "switch_organization": {
			const organizationId = resolveOrganizationId(args, session);
			return textResult(\`Switched to organization: \${organizationId}\`);
		}
`
		: ""
}
		default:
			throw new Error(\`Unknown tool: \${toolName}\`);
	}
}
`;
}

function generateMcpApiClient(_config: ProjectConfig): string {
	return `/**
 * Authenticated API client for MCP tool execution.
 * Forwards the session cookie (and/or Authorization header) from the MCP request.
 */
export class McpApiClient {
	constructor(
		private baseUrl: string,
		private headers: Record<string, string>,
	) {}

	private buildHeaders(extra?: Record<string, string>): Record<string, string> {
		return { ...this.headers, ...extra };
	}

	async get(path: string): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "GET",
			headers: this.buildHeaders(),
		});
		if (!response.ok) throw new Error(\`GET \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async post(path: string, body: unknown): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "POST",
			headers: this.buildHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify(body),
		});
		if (!response.ok) throw new Error(\`POST \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async put(path: string, body: unknown): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "PUT",
			headers: this.buildHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify(body),
		});
		if (!response.ok) throw new Error(\`PUT \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async delete(path: string): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "DELETE",
			headers: this.buildHeaders(),
		});
		if (!response.ok) throw new Error(\`DELETE \${path} failed: \${response.statusText}\`);
		return response.json();
	}
}
`;
}

function generateMcpUtils(): string {
	return `import type { HeaderRecord, ToolResult } from "./types";
import { SESSION_HEADER } from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const asString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

export const textResult = (text: string, structuredContent?: unknown): ToolResult => ({
	content: [{ type: "text", text }],
	...(structuredContent !== undefined ? { structuredContent } : {}),
});

export function getHeader(headers: HeaderRecord, name: string): string | undefined {
	const lowerName = name.toLowerCase();
	const match = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
	if (!match) return undefined;
	const value = match[1];
	if (Array.isArray(value)) return value[0];
	return value;
}

export function getSessionIdFromHeaders(headers: HeaderRecord): string | undefined {
	return getHeader(headers, SESSION_HEADER) ?? getHeader(headers, "Mcp-Session-Id");
}

export function getBearerToken(headers: HeaderRecord): string | undefined {
	const authorization = getHeader(headers, "authorization");
	if (!authorization?.startsWith("Bearer ")) return undefined;
	return authorization.slice("Bearer ".length).trim();
}
`;
}

function generateMcpResources(config: ProjectConfig): string {
	const widgetResources = config.includeMcpWebComponents
		? `
	"ui://widget/example.html": {
		name: "Example Widget",
		mimeType: "text/html+skybridge",
		async getContent() {
			// TODO: Import widget HTML from web-components build
			return \`<!DOCTYPE html>
<html>
	<head>
		<title>Example Widget</title>
	</head>
	<body>
		<div id="root"></div>
		<script>
			// Widget implementation
			document.getElementById("root").innerHTML = "<h1>Example Widget</h1>";
		</script>
	</body>
</html>\`;
		},
	},
`
		: "";

	return `export const resources = {
	"doc://app/getting-started": {
		name: "Getting Started Guide",
		mimeType: "text/markdown",
		async getContent() {
			return \`# Getting Started with ${config.name}

This is your MCP-enabled application. Use the available tools to interact with the system.

## Available Tools

- \\\`get_user\\\` - Get current user information
- \\\`list_records\\\` - List records
- \\\`create_record\\\` - Create a new record
${
	config.includeOrganizations
		? `- \\\`list_organizations\\\` - List organizations
- \\\`switch_organization\\\` - Switch default organization`
		: ""
}

## Resources

- \\\`doc://app/getting-started\\\` - This guide
${config.includeMcpWebComponents ? "- \`ui://widget/example.html\` - Example interactive widget" : ""}
\`;
		},
	},
${widgetResources}
};

export type ResourceUri = keyof typeof resources;
`;
}

function generateMcpTypes(config: ProjectConfig): string {
	return `export type JsonRecord = Record<string, unknown>;

export type HeaderRecord = Record<string, string | string[] | undefined>;

export type SessionInfo = {
	userId: string;
${config.includeOrganizations ? "\torganizationId?: string;" : ""}
};

export type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent?: unknown;
	isError?: boolean;
};

export const SESSION_HEADER = "mcp-session-id";
export const SESSION_TTL_MS = 30 * 60 * 1000;
`;
}

function generateMcpRoute(config: ProjectConfig): string {
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

function generateOAuthRoute(config: ProjectConfig): string {
	if (!config.includeMcpOAuth) return "";

	return `import { Hono } from "hono";
import type { Bindings } from "../env";

export const oauthRoutes = new Hono<{ Bindings: Bindings }>()
	.get("/openid-configuration", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			issuer,
			authorization_endpoint: \`\${issuer}/oauth/authorize\`,
			token_endpoint: \`\${issuer}/oauth/token\`,
			jwks_uri: \`\${issuer}/.well-known/jwks\`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
			scopes_supported: ["openid", "profile", "email"],
			token_endpoint_auth_methods_supported: ["client_secret_post"],
			claims_supported: ["sub", "email", "name"],
		});
	})

	.get("/oauth-authorization-server", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			issuer,
			authorization_endpoint: \`\${issuer}/oauth/authorize\`,
			token_endpoint: \`\${issuer}/oauth/token\`,
			jwks_uri: \`\${issuer}/.well-known/jwks\`,
			registration_endpoint: \`\${issuer}/oauth/register\`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			token_endpoint_auth_methods_supported: ["client_secret_post"],
		});
	})

	.get("/oauth-protected-resource/mcp", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			resource: \`\${issuer}/mcp\`,
			authorization_servers: [issuer],
		});
	})

	.get("/jwks", async (c) => {
		// Forward to Better Auth JWKS endpoint
		const response = await fetch(\`\${c.env.API_ORIGIN}/.well-known/jwks.json\`);
		const jwks = await response.json();
		return c.json(jwks);
	});
`;
}

export function generateMcpWebComponents(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	if (!config.includeMcpWebComponents) return;

	const webComponentsPath = join(projectPath, "packages/web-components");
	createDirectory(webComponentsPath);
	createDirectory(join(webComponentsPath, "src"));
	createDirectory(join(webComponentsPath, "src/components"));
	createDirectory(join(webComponentsPath, "src/utils"));
	createDirectory(join(webComponentsPath, "src/types"));

	// package.json
	const packageJson = {
		name: `@${config.name}/web-components`,
		private: true,
		type: "module",
		main: "dist/index.ts",
		scripts: {
			dev: "vite",
			"build:example":
				"WIDGET_NAME=example-widget WIDGET_ENTRY=src/example-widget-entry.tsx vite build",
			"build:all": `${config.packageManager} run build:example`,
			preview: "vite preview",
			serve: "vite preview --port 4444 --strictPort",
		},
		dependencies: {
			"@radix-ui/react-slot": "catalog:",
			"@tailwindcss/vite": "catalog:",
			"@tanstack/react-table": versions.get("@tanstack/react-table") || "^8.21.3",
			"class-variance-authority": versions.get("class-variance-authority") || "^0.7.1",
			clsx: versions.get("clsx") || "^2.1.1",
			jose: versions.get("jose") || "^6.1.0",
			"lucide-react": "catalog:",
			react: "catalog:",
			"react-dom": "catalog:",
			recharts: "catalog:",
			"tailwind-merge": versions.get("tailwind-merge") || "^3.4.0",
			tailwindcss: "catalog:",
		},
		devDependencies: {
			"@types/react": "catalog:",
			"@types/react-dom": "catalog:",
			"@vitejs/plugin-react": "catalog:",
			"tw-animate-css": versions.get("tw-animate-css") || "^1.4.0",
			typescript: "catalog:",
			vite: "catalog:",
		},
		exports: {
			".": {
				types: "./dist/index.ts",
				import: "./dist/index.ts",
			},
		},
	};

	writeFile(join(webComponentsPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src"],
		compilerOptions: {
			paths: {
				"@/*": ["./src/*"],
			},
		},
	};

	writeFile(join(webComponentsPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// vite.config.ts
	const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			input: process.env.WIDGET_ENTRY || "src/example-widget-entry.tsx",
			output: {
				format: "iife",
				entryFileNames: \`\${process.env.WIDGET_NAME || "example-widget"}.js\`,
			},
		},
	},
});
`;

	writeFile(join(webComponentsPath, "vite.config.ts"), viteConfig);

	// index.html
	const indexHtml = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${config.name} - Web Components Dev</title>
	</head>
	<body>
		<div id="root"></div>
		<script type="module" src="/src/dev-preview.tsx"></script>
	</body>
</html>
`;

	writeFile(join(webComponentsPath, "index.html"), indexHtml);

	// .env.example
	const envExample = config.includeMcpOAuth
		? `# MCP Server Configuration
VITE_APP_URL=http://localhost:5173
VITE_MCP_SERVER_URL=http://localhost:8787/mcp

# JWT Configuration for Development
# Generate RS256 key pair:
# openssl genrsa -out private.pem 2048
# openssl rsa -in private.pem -pubout -out public.pem
# Then paste the private key here (with \\n for newlines):
VITE_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"

# User ID for testing (create a user first)
VITE_USER_ID=YOUR_USER_ID_HERE
`
		: `# MCP Server Configuration
VITE_APP_URL=http://localhost:5173
VITE_MCP_SERVER_URL=http://localhost:8787/mcp

# User ID for testing (create a user first)
VITE_USER_ID=YOUR_USER_ID_HERE
`;

	writeFile(join(webComponentsPath, ".env.example"), envExample);

	// src/types/openai.ts
	const openaiTypes = generateOpenAiTypes();
	writeFile(join(webComponentsPath, "src/types/openai.ts"), openaiTypes);

	// src/utils/sse.ts
	const sseUtils = generateSseUtils();
	writeFile(join(webComponentsPath, "src/utils/sse.ts"), sseUtils);

	// src/dev-preview.tsx
	const devPreview = generateDevPreview(config);
	writeFile(join(webComponentsPath, "src/dev-preview.tsx"), devPreview);

	// src/example-widget-entry.tsx
	const exampleWidgetEntry = `import React from "react";
import ReactDOM from "react-dom/client";
import ExampleWidget from "./components/ExampleWidget";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ExampleWidget />
	</React.StrictMode>,
);
`;

	writeFile(join(webComponentsPath, "src/example-widget-entry.tsx"), exampleWidgetEntry);

	// src/components/ExampleWidget.tsx
	const exampleWidget = `import { useState } from "react";

export default function ExampleWidget() {
	const [count, setCount] = useState(0);

	return (
		<div style={{ padding: "20px", fontFamily: "system-ui" }}>
			<h1>Example Widget</h1>
			<p>This is a basic example widget for ChatGPT integration.</p>
			<button
				onClick={() => setCount(count + 1)}
				style={{
					padding: "10px 20px",
					backgroundColor: "#0066cc",
					color: "white",
					border: "none",
					borderRadius: "4px",
					cursor: "pointer",
				}}
			>
				Count: {count}
			</button>
			<p style={{ marginTop: "10px", color: "#666" }}>
				Customize this widget in packages/web-components/src/components/ExampleWidget.tsx
			</p>
		</div>
	);
}
`;

	writeFile(join(webComponentsPath, "src/components/ExampleWidget.tsx"), exampleWidget);
}

function generateOpenAiTypes(): string {
	return `export type DisplayMode = "pip" | "inline" | "fullscreen";

export type Theme = "light" | "dark";

export type UserAgent = "chatgpt-mobile" | "chatgpt-desktop";

export type SafeArea = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export type API = {
	callTool: <TInput = unknown, TOutput = unknown>(options: {
		toolName: string;
		parameters: TInput;
	}) => Promise<TOutput>;

	sendFollowUpMessage: (message: string) => Promise<void>;

	openExternal: (url: string) => Promise<void>;

	updateContentSize: (size: { width: number; height: number }) => Promise<void>;

	requestDisplayMode: (displayMode: DisplayMode) => Promise<void>;

	close: () => Promise<void>;

	toolOutput?: unknown;
};

export type OpenAiGlobals = {
	api: API;

	displayMode: DisplayMode;

	safeArea: SafeArea;

	theme: Theme;

	userAgent: UserAgent;
};

declare global {
	interface Window {
		openai?: OpenAiGlobals;
	}
}

export {};
`;
}

function generateSseUtils(): string {
	return `/**
 * Parse Server-Sent Events response and extract JSON data
 */
export async function parseSSEResponse<T = unknown>(response: Response): Promise<T> {
	const text = await response.text();
	const lines = text.split("\\n");
	const dataLines = lines.filter((line) => line.startsWith("data: "));

	if (dataLines.length === 0) {
		throw new Error("No data in SSE response");
	}

	const lastDataLine = dataLines[dataLines.length - 1];
	const jsonString = lastDataLine.substring(6); // Remove "data: " prefix

	return JSON.parse(jsonString) as T;
}
`;
}

function generateDevPreview(config: ProjectConfig): string {
	const hasOAuth = config.includeMcpOAuth;
	const hasOrganizations = config.includeOrganizations;

	const jwtImport = hasOAuth ? `import * as jose from "jose";` : "";
	const sessionIdHeader = `const SESSION_ID_HEADER = "mcp-session-id";`;

	const jwtSigningCode = hasOAuth
		? `
	// Generate JWT access token for OAuth
	const privateKey = await jose.importPKCS8(import.meta.env.VITE_JWT_PRIVATE_KEY, "RS256");
	const token = await new jose.SignJWT({ sub: userId })
		.setProtectedHeader({ alg: "RS256", kid: "main" })
		.setIssuedAt()
		.setIssuer(appUrl)
		.setAudience(mcpServerUrl)
		.setExpirationTime("24h")
		.sign(privateKey);

	return token;`
		: `
	// Simple bearer token (no OAuth)
	return "dev-token-" + userId;`;

	const organizationFields = hasOrganizations
		? `
	const [organizationId, setOrganizationId] = useState("");`
		: "";

	const organizationFormFields = hasOrganizations
		? `
				<div>
					<label className="block text-sm font-medium text-gray-300 mb-2">
						Organization ID (optional)
					</label>
					<input
						type="text"
						value={organizationId}
						onChange={(e) => setOrganizationId(e.target.value)}
						placeholder="org-xxx"
						className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>`
		: "";

	return `import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
${jwtImport}
import { parseSSEResponse } from "./utils/sse";
import type { OpenAiGlobals } from "./types/openai";
import ExampleWidget from "./components/ExampleWidget";

${sessionIdHeader}

// Widget registry - add your components here
type ComponentKey = "example-widget";

type ComponentConfig = {
	name: string;
	component: React.ComponentType;
	toolName: string;
	toolArgs: Record<string, unknown>;
};

const COMPONENTS: Record<ComponentKey, ComponentConfig> = {
	"example-widget": {
		name: "Example Widget",
		component: ExampleWidget,
		toolName: "get_user",
		toolArgs: {},
	},
};

let mcpSessionId: string | null = null;

async function generateAccessToken(userId: string, appUrl: string, mcpServerUrl: string) {${jwtSigningCode}
}

async function initializeMCPSession(
	accessToken: string,
	mcpServerUrl: string,
	userId: string${hasOrganizations ? `,\n\torganizationId?: string` : ""},
) {
	const response = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {
					roots: {
						listChanged: true,
					},
					sampling: {},
				},
				clientInfo: {
					name: "${config.name}-mcp-dev",
					version: "1.0.0",
				},
			},
		}),
	});

	if (!response.ok) {
		throw new Error(\`Failed to initialize MCP session: \${response.statusText}\`);
	}

	mcpSessionId = response.headers.get(SESSION_ID_HEADER);

	if (!mcpSessionId) {
		throw new Error("No session ID returned from MCP server");
	}

	// Send initialized notification
	const notifyResponse = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
			[SESSION_ID_HEADER]: mcpSessionId,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			method: "notifications/initialized",
		}),
	});

	if (!notifyResponse.ok) {
		throw new Error(\`Failed to send initialized notification: \${notifyResponse.statusText}\`);
	}

	return mcpSessionId;
}

async function callMcpTool(
	accessToken: string,
	mcpServerUrl: string,
	sessionId: string,
	toolName: string,
	args: Record<string, unknown>,
) {
	const response = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
			[SESSION_ID_HEADER]: sessionId,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: Date.now(),
			method: "tools/call",
			params: {
				name: toolName,
				arguments: args,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(\`Failed to call tool: \${response.statusText}\`);
	}

	const data = await parseSSEResponse(response);
	return data;
}

function DevPreview() {
	const [initialized, setInitialized] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [userId, setUserId] = useState(import.meta.env.VITE_USER_ID || "");${organizationFields}
	const [selectedComponent, setSelectedComponent] = useState<ComponentKey>("example-widget");
	const [accessToken, setAccessToken] = useState<string | null>(null);

	const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:5173";
	const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:8787/mcp";

	const handleInitialize = async () => {
		if (!userId) {
			setError("User ID is required");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Generate access token
			const token = await generateAccessToken(userId, appUrl, mcpServerUrl);
			setAccessToken(token);

			// Initialize MCP session
			await initializeMCPSession(
				token,
				mcpServerUrl,
				userId${hasOrganizations ? `,\n\t\t\t\torganizationId || undefined` : ""},
			);

			setInitialized(true);

			// Mock OpenAI globals for development
			window.openai = {
				api: {
					callTool: async ({ toolName, parameters }) => {
						if (!mcpSessionId || !token) {
							throw new Error("MCP session not initialized");
						}

						const result = await callMcpTool(token, mcpServerUrl, mcpSessionId, toolName, parameters);
						window.openai!.api.toolOutput = result;
						return result;
					},
					sendFollowUpMessage: async (message: string) => {
						console.log("Follow-up message:", message);
					},
					openExternal: async (url: string) => {
						window.open(url, "_blank");
					},
					updateContentSize: async (size) => {
						console.log("Update content size:", size);
					},
					requestDisplayMode: async (mode) => {
						console.log("Request display mode:", mode);
					},
					close: async () => {
						console.log("Close");
					},
				},
				displayMode: "fullscreen",
				safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
				theme: "dark",
				userAgent: "chatgpt-desktop",
			} as OpenAiGlobals;

			// Call initial tool to populate data
			const componentConfig = COMPONENTS[selectedComponent];
			if (componentConfig) {
				const result = await callMcpTool(
					token,
					mcpServerUrl,
					mcpSessionId!,
					componentConfig.toolName,
					componentConfig.toolArgs,
				);
				window.openai!.api.toolOutput = result;
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to initialize MCP session");
		} finally {
			setLoading(false);
		}
	};

	const handleComponentChange = async (key: ComponentKey) => {
		setSelectedComponent(key);

		// Load data for the new component
		if (initialized && accessToken && mcpSessionId) {
			const componentConfig = COMPONENTS[key];
			if (componentConfig) {
				try {
					const result = await callMcpTool(
						accessToken,
						mcpServerUrl,
						mcpSessionId,
						componentConfig.toolName,
						componentConfig.toolArgs,
					);
					window.openai!.api.toolOutput = result;
				} catch (err) {
					console.error("Failed to load component data:", err);
				}
			}
		}
	};

	if (!initialized) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
				<div className="max-w-md w-full bg-gray-900 rounded-lg p-8 space-y-6">
					<div>
						<h1 className="text-2xl font-bold">MCP Dev Preview</h1>
						<p className="text-gray-400 mt-2">Initialize MCP session to preview widgets</p>
					</div>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								User ID <span className="text-red-400">*</span>
							</label>
							<input
								type="text"
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
								placeholder="user-xxx"
								className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>${organizationFormFields}
					</div>

					{error && (
						<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
							{error}
						</div>
					)}

					<button
						onClick={handleInitialize}
						disabled={loading}
						className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-3 rounded-lg font-medium transition"
					>
						{loading ? "Initializing..." : "Initialize MCP Session"}
					</button>

					<div className="text-xs text-gray-500 space-y-1">
						<p>Make sure your MCP server is running at:</p>
						<p className="font-mono">{mcpServerUrl}</p>
					</div>
				</div>
			</div>
		);
	}

	const SelectedComponent = COMPONENTS[selectedComponent].component;

	return (
		<div className="min-h-screen bg-gray-950 text-gray-100">
			<div className="border-b border-gray-800 bg-gray-900 p-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<h1 className="text-xl font-bold">Widget Preview</h1>
					<select
						value={selectedComponent}
						onChange={(e) => handleComponentChange(e.target.value as ComponentKey)}
						className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{Object.entries(COMPONENTS).map(([key, config]) => (
							<option key={key} value={key}>
								{config.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="p-4">
				<div className="max-w-7xl mx-auto">
					<div className="bg-white text-gray-900 rounded-lg shadow-lg">
						<SelectedComponent />
					</div>
				</div>
			</div>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<DevPreview />
	</React.StrictMode>,
);
`;
}
