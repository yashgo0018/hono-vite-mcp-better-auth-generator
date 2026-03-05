import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateBackend(projectPath: string, config: ProjectConfig) {
	const backendPath = join(projectPath, "apps/backend");
	createDirectory(backendPath);
	createDirectory(join(backendPath, "src"));
	createDirectory(join(backendPath, "src/routes"));
	createDirectory(join(backendPath, "src/lib"));

	// package.json
	const deps: Record<string, string> = {
		"@hono/zod-validator": "^0.7.6",
		[`@${config.name}/utils`]: "workspace:*",
		hono: "^4.11.7",
		zod: "catalog:",
	};

	if (config.includeDatabase) {
		deps[`@${config.name}/db`] = "workspace:*";
	}

	if (config.includeAuth) {
		deps["better-auth"] = "^1.3.12";
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
			wrangler: "^3.107.0",
		},
	};

	writeFile(join(backendPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src", "wrangler.toml"],
		compilerOptions: {
			types: ["@cloudflare/workers-types", "bun-types"],
		},
	};

	writeFile(join(backendPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// wrangler.toml
	const wranglerToml = `name = "${config.name}-backend"
main = "src/index.ts"
compatibility_date = "2025-02-04"
compatibility_flags = ["nodejs_compat"]

[env.staging]
name = "${config.name}-backend-staging"

[env.production]
name = "${config.name}-backend"
`;

	writeFile(join(backendPath, "wrangler.toml"), wranglerToml);

	// src/index.ts
	const indexTs = generateBackendIndex(config);
	writeFile(join(backendPath, "src/index.ts"), indexTs);

	// src/env.ts
	const envTs = generateBackendEnv(config);
	writeFile(join(backendPath, "src/env.ts"), envTs);

	// src/routes/api.ts
	const apiTs = generateApiRoutes(config);
	writeFile(join(backendPath, "src/routes/api.ts"), apiTs);

	if (config.includeAuth) {
		// src/auth.ts
		const authTs = generateAuthConfig(config);
		writeFile(join(backendPath, "src/auth.ts"), authTs);

		// src/lib/middlewares.ts
		const middlewaresTs = generateMiddlewares(config);
		writeFile(join(backendPath, "src/lib/middlewares.ts"), middlewaresTs);
	}

	// .env.example
	const envExample = generateBackendEnvExample(config);
	writeFile(join(backendPath, ".env.example"), envExample);
}

function generateBackendIndex(config: ProjectConfig): string {
	const imports = [`import { Hono } from "hono";`, `import { cors } from "hono/cors";`];

	if (config.includeDatabase) {
		imports.push(`import { createDb } from "@${config.name}/db";`);
	}

	imports.push(`import type { Bindings } from "./env";`);
	imports.push(`import { apiRoutes } from "./routes/api";`);

	const contextSetup = config.includeDatabase
		? `	.use(async (c, next) => {
		const db = createDb(c.env.DATABASE_URL);
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
	.route("/api", apiRoutes)
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
			`	API_ORIGIN: z.string().url()`,
			`	WEB_ORIGIN: z.string().url()`,
		);
	}

	return `import { z } from "zod";

const envSchema = z.object({
${fields.join(",\n")}
});

export type Bindings = z.infer<typeof envSchema>;
`;
}

function generateApiRoutes(config: ProjectConfig): string {
	const imports = [`import { Hono } from "hono";`];

	if (config.includeAuth) {
		imports.push(`import { requireAuth } from "../lib/middlewares";`);
	}

	const routes = config.includeAuth
		? `	.get("/protected", requireAuth, (c) => {
		const user = c.get("user");
		return c.json({ message: "Protected route", user });
	})`
		: "";

	return `${imports.join("\n")}

export const apiRoutes = new Hono()
	.get("/health", (c) => {
		return c.json({ status: "ok", timestamp: new Date().toISOString() });
	})${routes};
`;
}

function generateAuthConfig(config: ProjectConfig): string {
	return `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, schema } from "@${config.name}/db";
import type { Bindings } from "./env";

export const createAuth = (env: Bindings) => {
	const db = createDb(env.DATABASE_URL);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				user: schema.users,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.API_ORIGIN,
		trustedOrigins: [env.WEB_ORIGIN],
	});
};
`;
}

function generateMiddlewares(config: ProjectConfig): string {
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

	return vars.join("\n") + "\n";
}
