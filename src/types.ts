export interface ProjectConfig {
	name: string;
	description: string;
	author: string;
	packageManager: "bun" | "npm" | "pnpm" | "yarn";
	includeBackend: boolean;
	includeFrontend: boolean;
	includeDatabase: boolean;
	includeAuth: boolean;
	includeGithubActions: boolean;
}

export interface TemplateData {
	projectName: string;
	projectDescription: string;
	author: string;
	packageManager: string;
}
