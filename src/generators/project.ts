import type { ProjectConfig } from "../types";
import { createDirectory } from "../utils/file-utils";
import {
  generateRootPackageJson,
  generateTsConfigBase,
  generateBiomeConfig,
  generateGitignore,
  generateReadme,
  generateVSCodeSettings,
} from "./root";
import { generateUtilsPackage } from "./utils";
import { generateDatabasePackage } from "./database";
import { generateBackend } from "./backend";
import { generateFrontend } from "./frontend/index";
import { generateGithubActions } from "./github-actions";
import { generateScripts } from "./scripts";
import { generateMcpWebComponents } from "./mcp/index";
import { versionCache } from "../utils/npm-registry";

export async function generateProject(projectPath: string, config: ProjectConfig) {
  // Get version map from cache (already fetched in index.ts)
  const versions = versionCache.cache;
  // Create root directory
  createDirectory(projectPath);

  // Create apps and packages directories
  createDirectory(`${projectPath}/apps`);
  createDirectory(`${projectPath}/packages`);

  // Generate root configuration files
  generateRootPackageJson(projectPath, config, versions);
  generateTsConfigBase(projectPath);
  generateBiomeConfig(projectPath);
  generateGitignore(projectPath);
  generateReadme(projectPath, config);
  generateVSCodeSettings(projectPath);

  // Generate utils package (always included)
  generateUtilsPackage(projectPath, config);

  // Generate database package
  if (config.includeDatabase) {
    generateDatabasePackage(projectPath, config, versions);
  }

  // Generate backend
  if (config.includeBackend) {
    generateBackend(projectPath, config, versions);
  }

  // Generate frontend
  if (config.includeFrontend) {
    generateFrontend(projectPath, config, versions);
  }

  // Generate GitHub Actions
  if (config.includeGithubActions) {
    generateGithubActions(projectPath, config);
  }

  // Generate MCP web components
  if (config.includeMcpWebComponents) {
    generateMcpWebComponents(projectPath, config, versions);
  }

  // Generate Scripts
  generateScripts(projectPath, config);
}
