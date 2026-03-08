import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";
import { generateMcpBackend } from "./mcp";

export function generateBackend(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	const backendPath = join(projectPath, "apps/backend");
	createDirectory(backendPath);
	createDirectory(join(backendPath, "src"));
	createDirectory(join(backendPath, "src/routes"));
	createDirectory(join(backendPath, "src/lib"));

	// package.json
	const deps: Record<string, string> = {
		"@hono/zod-validator": versions.get("@hono/zod-validator") || "^0.7.6",
		[`@${config.name}/utils`]: "workspace:*",
		hono: versions.get("hono") || "^4.11.7",
		zod: "catalog:",
	};

	if (config.includeDatabase) {
		deps[`@${config.name}/db`] = "workspace:*";
	}

	if (config.includeAuth) {
		deps["better-auth"] = versions.get("better-auth") || "^1.3.12";
		if (config.includeDatabase) {
			deps["@better-auth/drizzle-adapter"] = versions.get("@better-auth/drizzle-adapter") || "^1.3.12";
		}
	}

	if (config.includeMcp) {
		deps["@hono/mcp"] = versions.get("@hono/mcp") || "^0.2.3";
		deps["@modelcontextprotocol/sdk"] = versions.get("@modelcontextprotocol/sdk") || "^1.26.0";

		if (config.includeMcpOAuth) {
			deps["@better-auth/oauth-provider"] = versions.get("@better-auth/oauth-provider") || "^1.4.18";
		}
	}

	const packageJson = {
		name: `@${config.name}/backend`,
		type: "module",
		main: "src/index.ts",
		scripts: {
			dev: "wrangler dev",
			build: "wrangler deploy --dry-run",
			deploy: "wrangler deploy",
		},
		dependencies: deps,
		devDependencies: {
			"@cloudflare/workers-types": "catalog:",
			wrangler: versions.get("wrangler") || "^3.107.0",
		},
	};

	writeFile(join(backendPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src", "wrangler.json"],
		compilerOptions: {
			types: ["@cloudflare/workers-types", "bun-types"],
		},
	};

	writeFile(join(backendPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// wrangler.json
	const wranglerJson = generateWranglerJson(config);
	writeFile(join(backendPath, "wrangler.json"), JSON.stringify(wranglerJson, null, 2));

	// src/index.ts
	const indexTs = generateBackendIndex(config);
	writeFile(join(backendPath, "src/index.ts"), indexTs);

	// src/env.ts
	const envTs = generateBackendEnv(config);
	writeFile(join(backendPath, "src/env.ts"), envTs);

	// src/lib/response.ts
	writeFile(join(backendPath, "src/lib/response.ts"), generateResponseHelpers());

	// src/lib/db-url.ts
	if (config.includeDatabase) {
		writeFile(join(backendPath, "src/lib/db-url.ts"), generateDbUrl());
	}

	// src/routes/api.ts
	const apiTs = generateApiRoutes(config);
	writeFile(join(backendPath, "src/routes/api.ts"), apiTs);

	if (config.includeAuth) {
		// src/auth.ts
		const authTs = generateAuthConfig(config);
		writeFile(join(backendPath, "src/auth.ts"), authTs);

		// src/auth-with-env.ts (for Better Auth CLI)
		if (config.includeDatabase) {
			const authWithEnvTs = generateAuthWithEnv(config);
			writeFile(join(backendPath, "src/auth-with-env.ts"), authWithEnvTs);
		}

		// src/lib/middlewares.ts
		const middlewaresTs = generateMiddlewares(config);
		writeFile(join(backendPath, "src/lib/middlewares.ts"), middlewaresTs);
	}

	// .env.example
	const envExample = generateBackendEnvExample(config);
	writeFile(join(backendPath, ".env.example"), envExample);

	// MCP integration
	if (config.includeMcp) {
		generateMcpBackend(projectPath, config, versions);
	}
}

function generateResponseHelpers(): string {
	return `import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ok = <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
	c.json({ success: true, data }, status);

export const fail = (
	c: Context,
	message: string,
	status: ContentfulStatusCode = 400,
	details?: unknown,
) => c.json({ success: false, error: message, details }, status);

export const notImplemented = (c: Context, message = "Not implemented") =>
	fail(c, message, 501);
`;
}

function generateDbUrl(): string {
	return `import type { Bindings } from "../env";

export const resolveDatabaseUrl = (env: Pick<Bindings, "DATABASE_URL" | "HYPERDRIVE">) =>
	env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
`;
}

function generateBackendIndex(config: ProjectConfig): string {
	const imports = [`import { Hono } from "hono";`, `import { cors } from "hono/cors";`];

	if (config.includeDatabase) {
		imports.push(`import { createDb } from "@${config.name}/db";`);
		imports.push(`import { resolveDatabaseUrl } from "./lib/db-url";`);
	}

	imports.push(`import type { Bindings } from "./env";`);
	imports.push(`import { apiRoutes } from "./routes/api";`);

	if (config.includeMcp) {
		imports.push(`import { mcpRoutes } from "./routes/mcp";`);
	}

	if (config.includeMcpOAuth) {
		imports.push(`import { oauthRoutes } from "./routes/oauth";`);
	}

	const contextSetup = config.includeDatabase
		? `	.use(async (c, next) => {
		const db = createDb(resolveDatabaseUrl(c.env));
		c.set("db", db);
		await next();
	})`
		: "";

	return `${imports.join("\n")}

type Variables = {
${config.includeDatabase ? `	db: ReturnType<typeof createDb>;` : ""}
${config.includeAuth ? `	user?: { id: string; email: string; name: string };` : ""}
};

type CustomContext = {
	Bindings: Bindings;
	Variables: Variables;
};

const app = new Hono<CustomContext>()${contextSetup}
	.use(
		"*",
		cors({
			origin: (origin) => origin,
			credentials: true,
		}),
	)
	.route("/api", apiRoutes)${config.includeMcp ? `\n\t.route("/mcp", mcpRoutes)` : ""}${config.includeMcpOAuth ? `\n\t.route("/.well-known", oauthRoutes)` : ""}
	.get("/", (c) => {
		return c.json({ message: "Hello from ${config.name}!" });
	});

export default app;
export type AppType = typeof app;
`;
}

function generateBackendEnv(config: ProjectConfig): string {
	const fields: string[] = [`	APP_ENV: z.enum(["development", "staging", "production"])`];

	if (config.includeDatabase) {
		fields.push(`	DATABASE_URL: z.string().min(1)`);
	}

	if (config.includeAuth) {
		fields.push(
			`	BETTER_AUTH_SECRET: z.string().min(1)`,
			`	API_ORIGIN: z.url()`,
			`	WEB_ORIGIN: z.url()`,
		);
	}

	if (config.includeGoogleAuth) {
		fields.push(
			`	GOOGLE_CLIENT_ID: z.string().min(1)`,
			`	GOOGLE_CLIENT_SECRET: z.string().min(1)`,
		);
	}

	const cloudflareBindings: string[] = [];
	const cloudflareTypes: string[] = [];

	if (config.includeDatabase) {
		cloudflareBindings.push("\tHYPERDRIVE?: Hyperdrive;");
		cloudflareTypes.push("Hyperdrive");
	}

	if (config.includeKV) {
		cloudflareBindings.push("\tKV: KVNamespace;");
		cloudflareTypes.push("KVNamespace");
	}

	if (config.includeR2) {
		cloudflareBindings.push("\tR2: R2Bucket;");
		cloudflareTypes.push("R2Bucket");
	}

	const cfImport =
		cloudflareTypes.length > 0
			? `import type { ${cloudflareTypes.join(", ")} } from "@cloudflare/workers-types";\n`
			: "";

	const bindingsType =
		cloudflareBindings.length > 0 ? ` & {\n${cloudflareBindings.join("\n")}\n}` : "";

	return `${cfImport}import { z } from "zod";

const envSchema = z.object({
${fields.join(",\n")}
});

export type Bindings = z.infer<typeof envSchema>${bindingsType};
`;
}

function generateApiRoutes(config: ProjectConfig): string {
	const imports = [`import { Hono } from "hono";`, `import { ok, fail } from "../lib/response";`];

	if (config.includeAuth) {
		imports.push(`import { requireAuth } from "../lib/middlewares";`);
	}

	const routes = config.includeAuth
		? `	.get("/protected", requireAuth, (c) => {
		const user = c.get("user");
		return ok(c, { user });
	})`
		: "";

	return `${imports.join("\n")}

export const apiRoutes = new Hono()
	.get("/health", (c) => {
		return ok(c, { status: "ok", timestamp: new Date().toISOString() });
	})${routes};
`;
}

function generateAuthConfig(config: ProjectConfig): string {
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

function generateAuthWithEnv(config: ProjectConfig): string {
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

function generateMiddlewares(_config: ProjectConfig): string {
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

function generateWranglerJson(config: ProjectConfig) {
	const wranglerConfig: any = {
		name: `${config.name}-backend`,
		main: "src/index.ts",
		compatibility_date: "2025-02-04",
		compatibility_flags: ["nodejs_compat"],
	};

	if (config.includeObservability) {
		wranglerConfig.observability = {
			enabled: true,
		};
	}

	wranglerConfig.env = {
		staging: {
			name: `${config.name}-backend-staging`,
		},
		production: {
			name: `${config.name}-backend`,
		},
	};

	if (config.includeKV) {
		wranglerConfig.env.staging.kv_namespaces = [
			{
				binding: "KV",
				id: "REPLACE_WITH_KV_ID_STAGING",
			},
		];
		wranglerConfig.env.production.kv_namespaces = [
			{
				binding: "KV",
				id: "REPLACE_WITH_KV_ID_PRODUCTION",
			},
		];
	}

	if (config.includeR2) {
		wranglerConfig.env.staging.r2_buckets = [
			{
				binding: "R2",
				bucket_name: "REPLACE_WITH_R2_BUCKET_STAGING",
			},
		];
		wranglerConfig.env.production.r2_buckets = [
			{
				binding: "R2",
				bucket_name: "REPLACE_WITH_R2_BUCKET_PRODUCTION",
			},
		];
	}

	return wranglerConfig;
}

function generateBackendEnvExample(config: ProjectConfig): string {
	const vars: string[] = [`APP_ENV=development`];

	if (config.includeDatabase) {
		vars.push(`DATABASE_URL=postgresql://user:password@localhost:5432/${config.name}`);
	}

	if (config.includeAuth) {
		vars.push(
			`BETTER_AUTH_SECRET=replace-with-strong-secret`,
			`API_ORIGIN=http://localhost:8787`,
			`WEB_ORIGIN=http://localhost:5173`,
		);
	}

	if (config.includeGoogleAuth) {
		vars.push(
			`GOOGLE_CLIENT_ID=replace-with-google-client-id`,
			`GOOGLE_CLIENT_SECRET=replace-with-google-client-secret`,
		);
	}

	return vars.join("\n") + "\n";
}
