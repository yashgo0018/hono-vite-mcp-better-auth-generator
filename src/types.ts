export interface ProjectConfig {
	name: string;
	description: string;
	author: string;
	packageManager: "bun" | "npm" | "pnpm" | "yarn";

	// Core — independent
	includeBackend: boolean;
	includeFrontend: boolean;
	includeGithubActions: boolean;

	// Requires includeBackend
	includeDatabase: boolean;
	includeKV: boolean;
	includeR2: boolean;
	includeObservability: boolean;
	includeMcp: boolean;

	// Requires includeBackend && includeDatabase
	includeAuth: boolean;

	// Requires includeBackend && includeDatabase && includeAuth
	includeOrganizations: boolean;

	// MCP sub-options (require includeMcp)
	includeMcpOAuth: boolean;         // also requires includeAuth
	includeMcpWebComponents: boolean; // also requires includeFrontend
}

export interface TemplateData {
	projectName: string;
	projectDescription: string;
	author: string;
	packageManager: string;
}
