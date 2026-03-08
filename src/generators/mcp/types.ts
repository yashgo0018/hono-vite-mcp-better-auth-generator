import type { ProjectConfig } from "../../types";

export function generateMcpTypes(config: ProjectConfig): string {
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
