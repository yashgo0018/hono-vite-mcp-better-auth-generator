import type { ProjectConfig } from "../../types";

export function generateOAuthRoute(config: ProjectConfig): string {
	if (!config.includeMcpOAuth) return "";

	return `import { Hono } from "hono";
import type { Bindings } from "../env";

export const oauthRoutes = new Hono<{ Bindings: Bindings }>()
	.get("/openid-configuration", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			issuer,
			authorization_endpoint: \`\${issuer}/oauth/authorize\`,
			token_endpoint: \`\${issuer}/oauth/token\`,
			jwks_uri: \`\${issuer}/.well-known/jwks\`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
			scopes_supported: ["openid", "profile", "email"],
			token_endpoint_auth_methods_supported: ["client_secret_post"],
			claims_supported: ["sub", "email", "name"],
		});
	})

	.get("/oauth-authorization-server", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			issuer,
			authorization_endpoint: \`\${issuer}/oauth/authorize\`,
			token_endpoint: \`\${issuer}/oauth/token\`,
			jwks_uri: \`\${issuer}/.well-known/jwks\`,
			registration_endpoint: \`\${issuer}/oauth/register\`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			token_endpoint_auth_methods_supported: ["client_secret_post"],
		});
	})

	.get("/oauth-protected-resource/mcp", (c) => {
		const issuer = c.env.API_ORIGIN;
		return c.json({
			resource: \`\${issuer}/mcp\`,
			authorization_servers: [issuer],
		});
	})

	.get("/jwks", async (c) => {
		// Forward to Better Auth JWKS endpoint
		const response = await fetch(\`\${c.env.API_ORIGIN}/.well-known/jwks.json\`);
		const jwks = await response.json();
		return c.json(jwks);
	});
`;
}
