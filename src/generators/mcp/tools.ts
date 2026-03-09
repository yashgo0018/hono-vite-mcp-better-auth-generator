import type { ProjectConfig } from "../../types";

export function generateMcpTools(config: ProjectConfig): string {
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

export function generateMcpToolExecution(config: ProjectConfig): string {
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
