export interface ProjectConfig {
	name: string;
	description: string;
	author: string;
	packageManager: "bun" | "npm" | "pnpm" | "yarn";
	includeBackend: boolean;
	includeFrontend: boolean;
	includeDatabase: boolean;
	includeAuth: boolean;
	includeKV: boolean;
	includeR2: boolean;
	includeObservability: boolean;
	includeGithubActions: boolean;

	// MCP Options
	includeMcp: boolean;
	includeMcpOrganizations: boolean; // Requires includeMcp && includeAuth && includeDatabase
	includeMcpOAuth: boolean; // Requires includeMcp && includeAuth
	includeMcpWebComponents: boolean; // Requires includeMcp && includeFrontend
}

export interface TemplateData {
	projectName: string;
	projectDescription: string;
	author: string;
	packageManager: string;
}
