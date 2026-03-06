import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateGithubActions(projectPath: string, config: ProjectConfig) {
	const workflowsPath = join(projectPath, ".github/workflows");
	createDirectory(workflowsPath);

	if (config.includeBackend) {
		const deployBackend = generateDeployBackendWorkflow(config);
		writeFile(join(workflowsPath, "deploy-backend.yml"), deployBackend);
	}

	if (config.includeFrontend) {
		const deployWeb = generateDeployWebWorkflow(config);
		writeFile(join(workflowsPath, "deploy-web.yml"), deployWeb);
	}

	if (config.includeDatabase) {
		const dbMigrate = generateDbMigrateWorkflow(config);
		writeFile(join(workflowsPath, "db-migrate.yml"), dbMigrate);
	}

	const ciWorkflow = generateCIWorkflow(config);
	writeFile(join(workflowsPath, "ci.yml"), ciWorkflow);
}

function generateDeployBackendWorkflow(config: ProjectConfig): string {
	const secrets: string[] = ["APP_ENV"];
	const secretCommands: string[] = [];

	if (config.includeDatabase) {
		secrets.push("DATABASE_URL");
	}
	if (config.includeAuth) {
		secrets.push("BETTER_AUTH_SECRET");
	}

	// Generate secret put commands
	for (const secret of secrets) {
		if (secret === "APP_ENV") continue; // APP_ENV is set based on environment
		secretCommands.push(`printf "%s" "$${secret}" | bunx wrangler secret put ${secret}`);
	}

	// Generate variables
	const vars: string[] = [];
	if (config.includeAuth) {
		vars.push("API_ORIGIN", "WEB_ORIGIN");
	}

	const varFlags = vars
		.map((v) => `--var ${v}:\${{ vars.${v} }}`)
		.join(" \\\\\n            ");

	return `name: Deploy Backend

on:
  push:
    branches: [main, prod]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: \${{ github.ref_name == 'prod' && 'production' || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Deploy to Cloudflare (staging)
        if: github.ref_name != 'prod'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
${secrets
	.filter((s) => s !== "APP_ENV")
	.map((s) => `          ${s}: \${{ secrets.${s} }}`)
	.join("\n")}
        run: |
          cd apps/backend
${secretCommands.map((cmd) => `          ${cmd} --env staging`).join("\n")}
          printf "%s" "staging" | bunx wrangler secret put APP_ENV --env staging
          bunx wrangler deploy --env staging${varFlags ? ` \\\\\n            ${varFlags}` : ""}

      - name: Deploy to Cloudflare (production)
        if: github.ref_name == 'prod'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
${secrets
	.filter((s) => s !== "APP_ENV")
	.map((s) => `          ${s}: \${{ secrets.${s} }}`)
	.join("\n")}
        run: |
          cd apps/backend
${secretCommands.map((cmd) => `          ${cmd} --env production`).join("\n")}
          printf "%s" "production" | bunx wrangler secret put APP_ENV --env production
          bunx wrangler deploy --env production${varFlags ? ` \\\\\n            ${varFlags}` : ""}
`;
}

function generateDeployWebWorkflow(config: ProjectConfig): string {
	const frontendVars: string[] = [];

	if (config.includeBackend) {
		frontendVars.push("VITE_API_ORIGIN");
	}

	const envVars = frontendVars
		.map((v) => `          ${v}: \${{ vars.${v} }}`)
		.join("\n");

	return `name: Deploy Web

on:
  push:
    branches: [main, prod]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: \${{ github.ref_name == 'prod' && 'production' || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Build
${envVars ? `        env:\n${envVars}\n` : ""}        run: |
          cd apps/web
          ${config.packageManager === "bun" ? "bun run" : config.packageManager === "npm" ? "npm run" : config.packageManager} build

      - name: Deploy to Cloudflare Pages (staging)
        if: github.ref_name != 'prod'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          bunx wrangler pages deploy apps/web/dist \\
            --project-name ${config.name}-web \\
            --branch staging

      - name: Deploy to Cloudflare Pages (production)
        if: github.ref_name == 'prod'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          bunx wrangler pages deploy apps/web/dist \\
            --project-name ${config.name}-web \\
            --branch production
`;
}

function generateDbMigrateWorkflow(config: ProjectConfig): string {
	return `name: Database Migration

on:
  push:
    branches: [main, prod]
    paths:
      - "packages/db/**"
  workflow_dispatch:

concurrency:
  group: db-migrate-\${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment:
      name: \${{ github.ref_name == 'prod' && 'production' || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Run migrations
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
        working-directory: packages/db
        run: ${config.packageManager === "bun" ? "bunx" : "npx"} drizzle-kit migrate
`;
}

function generateCIWorkflow(config: ProjectConfig): string {
	return `name: CI

on:
  pull_request:
  push:
    branches: [main, prod]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Run Biome
        run: ${config.packageManager === "bun" ? "bunx" : "npx"} biome check .

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Type check
        run: ${config.packageManager === "bun" ? "bunx" : "npx"} tsc --noEmit

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: ${config.packageManager} install

      - name: Build
        run: ${config.packageManager} run build
`;
}
