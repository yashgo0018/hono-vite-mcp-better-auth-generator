import type { ProjectConfig } from "../../types";

export function generateAuthConfig(config: ProjectConfig): string {
  const plugins = [];
  const pluginImports = [`import { betterAuth } from "better-auth";`];

  if (config.includeOrganizations) {
    pluginImports.push(`import { organization } from "better-auth/plugins";`);
    plugins.push(`organization()`);
  }

  if (config.includeMcpOAuth) {
    pluginImports.push(`import { jwt } from "better-auth/plugins";`);
    pluginImports.push(`import { oauthProvider } from "@better-auth/oauth-provider";`);
    plugins.push(`jwt()`);
    plugins.push(`\n\t\toauthProvider({
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			loginPage: env.WEB_ORIGIN
				? \`\${env.WEB_ORIGIN.replace(/\\/$/, "")}/auth/login\`
				: "/auth/login",
			consentPage: env.WEB_ORIGIN
				? \`\${env.WEB_ORIGIN.replace(/\\/$/, "")}/consent\`
				: "/consent",
			validAudiences: (() => {
				const audiences = [env.API_ORIGIN, env.WEB_ORIGIN];${
          config.includeMcp
            ? `
				const apiOrigin = env.API_ORIGIN.replace(/\\/$/, "");
				audiences.push(\`\${apiOrigin}/mcp\`);`
            : ""
        }
				return [...new Set(audiences)];
			})(),
			silenceWarnings: {
				oauthAuthServerConfig: true,
			},
		})`);
  }

  const disabledPaths = config.includeMcpOAuth ? `\n\t\tdisabledPaths: ["/token"],` : "";

  const socialProviders = config.includeGoogleAuth
    ? `\n\t\tsocialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
		},`
    : "";

  return `${pluginImports.join("\n")}
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb } from "@${config.name}/db";
import type { Bindings } from "./env";

export const createAuth = (env: Bindings) => {
	const db = createDb(env.DATABASE_URL);

	return betterAuth({${plugins.length > 0 ? `\n\t\tplugins: [${plugins.join(", ")}],` : ""}
		database: drizzleAdapter(db, { provider: "pg" }),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.API_ORIGIN,
		trustedOrigins: [env.WEB_ORIGIN],
		advanced: {
			database: {
				generateId: "uuid",
			},
		},${disabledPaths}${socialProviders}
	});
};

export const getAuth = (env: Bindings) => createAuth(env);
`;
}

export function generateAuthWithEnv(config: ProjectConfig): string {
  return `import { getAuth } from "./auth";
import type { Bindings } from "./env";

/**
 * Auth configuration for Better Auth CLI
 * This file is used by the Better Auth CLI to generate the database schema
 * Run: ${config.packageManager} run auth:generate
 */
export const auth = getAuth(process.env as unknown as Bindings);
`;
}

export function generateMiddlewares(_config: ProjectConfig): string {
  return `import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";

export const requireAuth: MiddlewareHandler = async (c, next) => {
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("user", session.user);
	await next();
};
`;
}
