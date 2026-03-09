export function generateMcpUtils(): string {
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
