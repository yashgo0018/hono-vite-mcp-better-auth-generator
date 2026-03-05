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
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
        run: |
          cd apps/backend
          printf "%s" "$DATABASE_URL" | bunx wrangler secret put DATABASE_URL --env staging
          bunx wrangler deploy --env staging

      - name: Deploy to Cloudflare (production)
        if: github.ref_name == 'prod'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
        run: |
          cd apps/backend
          printf "%s" "$DATABASE_URL" | bunx wrangler secret put DATABASE_URL --env production
          bunx wrangler deploy --env production
`;
}

function generateDeployWebWorkflow(config: ProjectConfig): string {
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
        env:
          VITE_API_ORIGIN: \${{ vars.VITE_API_ORIGIN }}
        run: |
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
