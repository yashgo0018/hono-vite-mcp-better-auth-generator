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

	return `import { verifyOAuthAccessToken as verifyToken } from "@better-auth/oauth-provider/resource-client";
import { createHmac } from "crypto";

export async function verifyOAuthAccessToken(
	accessToken: string,
	apiOrigin: string,
) {
	const result = await verifyToken({
		token: accessToken,
		issuer: apiOrigin,
	});

	if (!result.valid) {
		throw new Error("Invalid access token");
	}

	return { userId: result.userId, organizationId: result.organizationId };
}

export function getSessionCookieForMcpBearer(
	accessToken: string,
	secret: string,
): string {
	// Convert Bearer token to session cookie for API calls
	const signedValue = createHmac("sha256", secret)
		.update(accessToken)
		.digest("hex");
	return \`better-auth.session_token=\${signedValue}\`;
}
`;
}

function generateMcpSession(config: ProjectConfig): string {
	return `import type { McpServer } from "@hono/mcp";
import type { StreamableHTTPTransport } from "@hono/mcp";

export interface McpSession {
	server: McpServer;
	transport: StreamableHTTPTransport;
	userId: string;
${config.includeMcpOrganizations ? "\tdefaultOrganizationId?: string;" : ""}
	createdAt: Date;
	lastAccessedAt: Date;
}

// In-memory session store (consider using KV for production)
export const sessionStore = new Map<string, McpSession>();

// Session TTL: 30 minutes
const SESSION_TTL = 30 * 60 * 1000;

export function storeSession(sessionId: string, session: McpSession) {
	sessionStore.set(sessionId, session);
}

export function getSession(sessionId: string): McpSession | undefined {
	const session = sessionStore.get(sessionId);

	if (!session) {
		return undefined;
	}

	// Check if session expired
	const now = new Date();
	const elapsed = now.getTime() - session.lastAccessedAt.getTime();

	if (elapsed > SESSION_TTL) {
		sessionStore.delete(sessionId);
		return undefined;
	}

	// Update last accessed time
	session.lastAccessedAt = now;
	return session;
}

export function deleteSession(sessionId: string) {
	sessionStore.delete(sessionId);
}

// Cleanup expired sessions (call this periodically)
export function cleanupExpiredSessions() {
	const now = new Date();

	for (const [sessionId, session] of sessionStore.entries()) {
		const elapsed = now.getTime() - session.lastAccessedAt.getTime();

		if (elapsed > SESSION_TTL) {
			sessionStore.delete(sessionId);
		}
	}
}
`;
}

function generateMcpTools(config: ProjectConfig): string {
	return `import { z } from "zod";
import type { ToolExecutionContext } from "./types";

export const tools = {
	get_user: {
		description: "Get current authenticated user information",
		inputSchema: z.object({}),
		async execute(ctx: ToolExecutionContext) {
			const user = await ctx.api.get(\`/api/users/\${ctx.userId}\`);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(user, null, 2),
					},
				],
			};
		},
	},

	list_records: {
		description: "List example records (customize this tool for your domain)",
		inputSchema: z.object({
			limit: z.number().min(1).max(100).default(10),
		}),
		async execute(ctx: ToolExecutionContext, input: { limit: number }) {
			// TODO: Implement your domain-specific record listing
			const records = await ctx.api.get(\`/api/records?limit=\${input.limit}\`);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(records, null, 2),
					},
				],
			};
		},
	},

	create_record: {
		description: "Create a new record (customize this tool for your domain)",
		inputSchema: z.object({
			name: z.string().min(1),
			description: z.string().optional(),
		}),
		async execute(
			ctx: ToolExecutionContext,
			input: { name: string; description?: string },
		) {
			// TODO: Implement your domain-specific record creation
			const record = await ctx.api.post("/api/records", {
				name: input.name,
				description: input.description,
			});
			return {
				content: [
					{
						type: "text" as const,
						text: \`Record created successfully: \${JSON.stringify(record, null, 2)}\`,
					},
				],
			};
		},
	},
${
	config.includeMcpOrganizations
		? `
	list_organizations: {
		description: "List organizations the user belongs to",
		inputSchema: z.object({}),
		async execute(ctx: ToolExecutionContext) {
			const orgs = await ctx.api.get("/api/organizations");
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(orgs, null, 2),
					},
				],
			};
		},
	},

	switch_organization: {
		description: "Switch the default organization for this MCP session",
		inputSchema: z.object({
			organizationId: z.string(),
			sessionId: z.string().optional(),
		}),
		async execute(ctx: ToolExecutionContext, input: { organizationId: string; sessionId?: string }) {
			// TODO: Validate user has access to this organization
			// TODO: Update session's default organization in database
			// Example: await db.update(mcpSession).set({ defaultOrganizationId: input.organizationId }).where(eq(mcpSession.id, sessionId))
			return {
				content: [
					{
						type: "text" as const,
						text: \`Switched to organization: \${input.organizationId}\`,
					},
				],
			};
		},
	},
`
		: ""
}
};

export type ToolName = keyof typeof tools;
`;
}

function generateMcpToolExecution(config: ProjectConfig): string {
	return `import { tools } from "./tools";
import type { ToolExecutionContext } from "./types";

export async function executeTool(
	toolName: string,
	args: any,
	ctx: ToolExecutionContext,
) {
	const tool = tools[toolName as keyof typeof tools];

	if (!tool) {
		throw new Error(\`Unknown tool: \${toolName}\`);
	}

	// Validate input
	const validatedInput = tool.inputSchema.parse(args);

	// Execute tool
	return await tool.execute(ctx, validatedInput);
}
`;
}

function generateMcpApiClient(config: ProjectConfig): string {
	return `/**
 * API client for making authenticated requests to the backend
 * Uses session cookies for authentication
 */
export class McpApiClient {
	constructor(
		private baseUrl: string,
		private sessionCookie: string,
	) {}

	async get(path: string): Promise<any> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "GET",
			headers: {
				Cookie: this.sessionCookie,
			},
		});

		if (!response.ok) {
			throw new Error(\`API request failed: \${response.statusText}\`);
		}

		return response.json();
	}

	async post(path: string, body: any): Promise<any> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: this.sessionCookie,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(\`API request failed: \${response.statusText}\`);
		}

		return response.json();
	}

	async put(path: string, body: any): Promise<any> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Cookie: this.sessionCookie,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(\`API request failed: \${response.statusText}\`);
		}

		return response.json();
	}

	async delete(path: string): Promise<any> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "DELETE",
			headers: {
				Cookie: this.sessionCookie,
			},
		});

		if (!response.ok) {
			throw new Error(\`API request failed: \${response.statusText}\`);
		}

		return response.json();
	}
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
	config.includeMcpOrganizations
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
	return `import type { McpApiClient } from "./api-client";

export interface ToolExecutionContext {
	userId: string;
${config.includeMcpOrganizations ? "\tdefaultOrganizationId?: string;" : ""}
	api: McpApiClient;
}
`;
}

function generateMcpRoute(config: ProjectConfig): string {
	const oauthImports = config.includeMcpOAuth
		? `import { verifyOAuthAccessToken, getSessionCookieForMcpBearer } from "../mcp/auth";`
		: "";

	const authVerification = config.includeMcpOAuth
		? `
		// Verify OAuth access token
		const base = c.env.API_ORIGIN;
		const resourceMetadataUrl = \`\${base}/.well-known/oauth-protected-resource/mcp\`;

		const authHeader = c.req.header("Authorization");
		const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : undefined;

		if (!bearerToken) {
			c.header("WWW-Authenticate", \`Bearer resource_metadata="\${resourceMetadataUrl}"\`);
			c.header("Access-Control-Expose-Headers", "WWW-Authenticate");
			return c.json({ error: "Unauthorized" }, 401);
		}

		let verified;
		try {
			verified = await verifyOAuthAccessToken(bearerToken, c.env.API_ORIGIN);
		} catch (error) {
			c.header("WWW-Authenticate", \`Bearer resource_metadata="\${resourceMetadataUrl}"\`);
			c.header("Access-Control-Expose-Headers", "WWW-Authenticate");
			return c.json({ error: "Invalid access token" }, 401);
		}

		const sessionCookie = getSessionCookieForMcpBearer(bearerToken, c.env.BETTER_AUTH_SECRET);
`
		: `
		// TODO: Implement authentication
		const verified = { userId: "user-123" };
		const sessionCookie = ""; // TODO: Get session cookie
`;

	const databaseImports = config.includeDatabase
		? `import { schema } from "@${config.name}/db";
import { eq } from "drizzle-orm";`
		: "";

	return `import { McpServer } from "@hono/mcp";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
${oauthImports}
${databaseImports}
import { storeSession, getSession, deleteSession } from "../mcp/session";
import { executeTool } from "../mcp/tool-execution";
import { tools } from "../mcp/tools";
import { resources } from "../mcp/resources";
import { McpApiClient } from "../mcp/api-client";
import type { Bindings } from "../env";

export const mcpRoutes = new Hono<{ Bindings: Bindings }>()
	.post("/", async (c) => {
${authVerification}

		const body = await c.req.json();
		const sessionId = c.req.header("mcp-session-id") || crypto.randomUUID();

		// Handle initialize method
		if (body?.method === "initialize") {
			// Create new MCP server
			const server = new McpServer({
				name: "${config.name} MCP Server",
				version: "1.0.0",
			});

			// Register tools
			for (const [toolName, tool] of Object.entries(tools)) {
				server.addTool({
					name: toolName,
					description: tool.description,
					inputSchema: tool.inputSchema,
				});
			}

			// Register resources
			for (const [uri, resource] of Object.entries(resources)) {
				server.addResource({
					uri,
					name: resource.name,
					mimeType: resource.mimeType,
				});
			}

			// Set up tool execution handler
			server.setToolHandler(async (toolName, args) => {
				const api = new McpApiClient(c.env.API_ORIGIN, sessionCookie);
${
	config.includeMcpOrganizations && config.includeDatabase
		? `
				// Fetch current session to get defaultOrganizationId
				const db = c.get("db");
				const [sessionRow] = await db
					.select()
					.from(schema.mcpSession)
					.where(eq(schema.mcpSession.id, sessionId))
					.limit(1);
`
		: ""
}
				const ctx = {
					userId: verified.userId,
${config.includeMcpOrganizations && config.includeDatabase ? "\t\t\t\t\tdefaultOrganizationId: sessionRow?.defaultOrganizationId ?? undefined," : ""}
					api,
				};
				return await executeTool(toolName, args, ctx);
			});

			// Set up resource handler
			server.setResourceHandler(async (uri) => {
				const resource = resources[uri as keyof typeof resources];
				if (!resource) {
					throw new Error(\`Resource not found: \${uri}\`);
				}
				const content = await resource.getContent();
				return {
					contents: [
						{
							uri,
							mimeType: resource.mimeType,
							text: content,
						},
					],
				};
			});

			// Create transport
			const transport = new StreamableHTTPTransport({
				sessionIdGenerator: () => sessionId,
			});

			// Connect server to transport
			await server.connect(transport);

			// Store session
			storeSession(sessionId, {
				server,
				transport,
				userId: verified.userId,
				createdAt: new Date(),
				lastAccessedAt: new Date(),
			});

${
	config.includeDatabase
		? `
			// Persist session to database (defaultOrganizationId is nullable and can be set later)
			const db = c.get("db");
			await db.insert(schema.mcpSession).values({
				id: sessionId,
				userId: verified.userId,
			});
`
		: ""
}

			// Handle the initialize request
			const response = await transport.handleRequest(c.req.raw);
			return new Response(response.body, {
				status: response.status,
				headers: response.headers,
			});
		}

		// Handle subsequent requests
		const session = getSession(sessionId);
		if (!session) {
			return c.json({ error: "Session not found or expired" }, 404);
		}

		const response = await session.transport.handleRequest(c.req.raw);
		return new Response(response.body, {
			status: response.status,
			headers: response.headers,
		});
	})

	.delete("/:sessionId", async (c) => {
		const sessionId = c.params.sessionId;
		deleteSession(sessionId);

${
	config.includeDatabase
		? `
		// Delete from database
		const db = c.get("db");
		await db.delete(schema.mcpSession).where(eq(schema.mcpSession.id, sessionId));
`
		: ""
}

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
	const hasOrganizations = config.includeMcpOrganizations;

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
