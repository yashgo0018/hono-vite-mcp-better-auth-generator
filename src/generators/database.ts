import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateDatabasePackage(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	const dbPath = join(projectPath, "packages/db");
	createDirectory(dbPath);
	createDirectory(join(dbPath, "src"));
	createDirectory(join(dbPath, "drizzle"));

	// package.json
	const packageJson = {
		name: `@${config.name}/db`,
		type: "module",
		main: "src/index.ts",
		exports: {
			".": "./src/index.ts",
		},
		dependencies: {
			[`@${config.name}/utils`]: "workspace:*",
			"drizzle-orm": versions.get("drizzle-orm") || "^0.45.1",
			postgres: versions.get("postgres") || "^3.4.7",
		},
		devDependencies: {
			"drizzle-kit": versions.get("drizzle-kit") || "^0.31.8",
		},
	};

	writeFile(join(dbPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src"],
	};

	writeFile(join(dbPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// drizzle.config.ts
	const drizzleConfig = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "",
	},
	migrations: {
		prefix: "timestamp",
	},
});
`;

	writeFile(join(dbPath, "drizzle.config.ts"), drizzleConfig);

	// src/index.ts
	const indexTs = `import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const createDb = (databaseUrl: string) => {
	const client = postgres(databaseUrl, {
		prepare: false, // Important for Cloudflare Workers
		max: 1, // Hyperdrive already pools connections
	});

	return drizzle(client, { schema });
};

export { schema };
export type Database = ReturnType<typeof createDb>;
`;

	writeFile(join(dbPath, "src/index.ts"), indexTs);

	// src/schema.ts
	const schemaTs = config.includeAuth
		? `import { pgTable, uuid, text, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Example table
export const example = pgTable("example", {
	id: uuid("id")
		.default(sql\`pg_catalog.gen_random_uuid()\`)
		.primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Export all tables
export * from "./auth-schema";
`
		: `import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Example table
export const example = pgTable("example", {
	id: uuid("id")
		.default(sql\`pg_catalog.gen_random_uuid()\`)
		.primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
`;

	writeFile(join(dbPath, "src/schema.ts"), schemaTs);

	// .env.example
	const envExample = `DATABASE_URL=postgresql://user:password@localhost:5432/database_name
`;

	writeFile(join(dbPath, ".env.example"), envExample);
}
