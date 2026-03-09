import type { ProjectConfig } from "../../types";

export function generateMcpApiClient(_config: ProjectConfig): string {
  return `/**
 * Authenticated API client for MCP tool execution.
 * Forwards the session cookie (and/or Authorization header) from the MCP request.
 */
export class McpApiClient {
	constructor(
		private baseUrl: string,
		private headers: Record<string, string>,
	) {}

	private buildHeaders(extra?: Record<string, string>): Record<string, string> {
		return { ...this.headers, ...extra };
	}

	async get(path: string): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "GET",
			headers: this.buildHeaders(),
		});
		if (!response.ok) throw new Error(\`GET \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async post(path: string, body: unknown): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "POST",
			headers: this.buildHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify(body),
		});
		if (!response.ok) throw new Error(\`POST \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async put(path: string, body: unknown): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "PUT",
			headers: this.buildHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify(body),
		});
		if (!response.ok) throw new Error(\`PUT \${path} failed: \${response.statusText}\`);
		return response.json();
	}

	async delete(path: string): Promise<unknown> {
		const response = await fetch(\`\${this.baseUrl}\${path}\`, {
			method: "DELETE",
			headers: this.buildHeaders(),
		});
		if (!response.ok) throw new Error(\`DELETE \${path} failed: \${response.statusText}\`);
		return response.json();
	}
}
`;
}
