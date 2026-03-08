import type { ProjectConfig } from "../../types";

export function generateMcpSession(config: ProjectConfig): string {
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
