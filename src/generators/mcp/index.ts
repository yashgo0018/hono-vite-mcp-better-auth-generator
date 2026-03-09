import { join } from "node:path";
import type { ProjectConfig } from "../../types";
import { createDirectory, writeFile } from "../../utils/file-utils";
import { generateMcpApiClient } from "./api-client";
import { generateMcpAuth } from "./auth";
import { generateOAuthRoute } from "./oauth-route";
import { generateMcpResources } from "./resources";
import { generateMcpRoute } from "./route";
import { generateMcpSession } from "./session";
import { generateMcpToolExecution, generateMcpTools } from "./tools";
import { generateMcpTypes } from "./types";
import { generateMcpUtils } from "./utils";

export { generateMcpWebComponents } from "./web-components";

export function generateMcpBackend(projectPath: string, config: ProjectConfig) {
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
