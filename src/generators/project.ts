import type { ProjectConfig } from "../types";
import { createDirectory } from "../utils/file-utils";
import {
	generateRootPackageJson,
	generateTsConfigBase,
	generateBiomeConfig,
	generateGitignore,
	generateReadme,
} from "./root";
import { generateUtilsPackage } from "./utils";
import { generateDatabasePackage } from "./database";
import { generateBackend } from "./backend";
import { generateFrontend } from "./frontend";
import { generateGithubActions } from "./github-actions";

export async function generateProject(projectPath: string, config: ProjectConfig) {
	// Create root directory
	createDirectory(projectPath);

	// Create apps and packages directories
	createDirectory(`${projectPath}/apps`);
	createDirectory(`${projectPath}/packages`);

	// Generate root configuration files
	generateRootPackageJson(projectPath, config);
	generateTsConfigBase(projectPath);
	generateBiomeConfig(projectPath);
	generateGitignore(projectPath);
	generateReadme(projectPath, config);

	// Generate utils package (always included)
	generateUtilsPackage(projectPath, config);

	// Generate database package
	if (config.includeDatabase) {
		generateDatabasePackage(projectPath, config);
	}

	// Generate backend
	if (config.includeBackend) {
		generateBackend(projectPath, config);
	}

	// Generate frontend
	if (config.includeFrontend) {
		generateFrontend(projectPath, config);
	}

	// Generate GitHub Actions
	if (config.includeGithubActions) {
		generateGithubActions(projectPath, config);
	}
}
