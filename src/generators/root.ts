import { join } from "path";
import type { ProjectConfig } from "../types";
import { writeFile } from "../utils/file-utils";

export function generateRootPackageJson(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	const catalog: Record<string, string> = {
		"@cloudflare/workers-types": versions.get("@cloudflare/workers-types") || "^4.20260131.0",
		typescript: versions.get("typescript") || "^5.9.3",
		zod: versions.get("zod") || "^4.3.6",
	};

	if (config.includeFrontend) {
		// Core Frontend Tooling
		catalog["@tailwindcss/vite"] = versions.get("@tailwindcss/vite") || "^4.1.18";
		catalog.tailwindcss = versions.get("tailwindcss") || "^4.1.18";
		catalog["@types/react"] = versions.get("@types/react") || "^19.2.10";
		catalog["@types/react-dom"] = versions.get("@types/react-dom") || "^19.2.3";
		catalog.react = versions.get("react") || "^19.2.4";
		catalog["react-dom"] = versions.get("react-dom") || "^19.2.4";
		catalog.vite = versions.get("vite") || "^7.3.1";
		catalog["@vitejs/plugin-react"] = versions.get("@vitejs/plugin-react") || "^6.0.1";

		// Icons & Charts
		catalog["lucide-react"] = versions.get("lucide-react") || "^0.563.0";
		catalog.recharts = versions.get("recharts") || "^3.7.0";

		// shadcn/ui dependencies
		catalog["@radix-ui/react-slot"] = versions.get("@radix-ui/react-slot") || "^1.2.4";
	}

	const packageJson = {
		name: config.name,
		private: true,
		description: config.description,
		author: config.author,
		packageManager:
			config.packageManager === "bun"
				? `bun@${versions.get("bun") || "1.2.18"}`
				: undefined,
		workspaces: {
			packages: ["apps/*", "packages/*"],
			catalog,
		},
		scripts: {
			dev: config.includeBackend && config.includeFrontend
				? `wrangler dev --config apps/backend/wrangler.json & ${config.packageManager} --cwd apps/web dev`
				: config.includeBackend
					? "wrangler dev --config apps/backend/wrangler.json"
					: config.includeFrontend
						? `${config.packageManager} --cwd apps/web dev`
						: undefined,
			build: [
				config.includeFrontend && `${config.packageManager} --cwd apps/web build`,
				config.includeBackend && `${config.packageManager} --cwd apps/backend build`,
			]
				.filter(Boolean)
				.join(" && "),
			"db:migrate":
				config.includeDatabase
					? `dotenv -e apps/backend/.env -- sh -c "cd packages/db && ${config.packageManager === "bun" ? "bunx" : "npx"} drizzle-kit migrate"`
					: undefined,
			"auth:generate":
				config.includeAuth && config.includeDatabase
					? `${config.packageManager === "bun" ? "bunx" : "npx"} @better-auth/cli generate -y --config ./apps/backend/src/auth-with-env.ts --output ./packages/db/src/auth-schema.ts`
					: undefined,
			lint: `${config.packageManager === "bun" ? "bunx" : "npx"} biome check .`,
			"lint:fix": `${config.packageManager === "bun" ? "bunx" : "npx"} biome check --write .`,
			format: `${config.packageManager === "bun" ? "bunx" : "npx"} biome format --write .`,
			typecheck: `${config.packageManager === "bun" ? "bunx" : "npx"} tsc --noEmit`,
		},
		devDependencies: {
			"@biomejs/biome": versions.get("@biomejs/biome") || "^2.3.13",
			"dotenv-cli": versions.get("dotenv-cli") || "^11.0.0",
			...(config.packageManager === "bun" ? { "bun-types": versions.get("bun-types") || "^1.3.8" } : {}),
		},
	};

	writeFile(join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2));
}

export function generateTsConfigBase(projectPath: string) {
	const tsConfig = {
		compilerOptions: {
			target: "ES2022",
			lib: ["ES2022", "DOM", "DOM.Iterable"],
			module: "ESNext",
			moduleResolution: "Bundler",
			strict: true,
			jsx: "react-jsx",
			resolveJsonModule: true,
			allowJs: false,
			noEmit: true,
			skipLibCheck: true,
			types: ["bun-types"],
		},
	};

	writeFile(join(projectPath, "tsconfig.base.json"), JSON.stringify(tsConfig, null, 2));
}

export function generateBiomeConfig(projectPath: string) {
	const biomeConfig = {
		$schema: "./node_modules/@biomejs/biome/configuration_schema.json",
		vcs: {
			enabled: true,
			clientKind: "git",
			useIgnoreFile: true,
		},
		files: {
			ignoreUnknown: false,
			ignore: [],
		},
		formatter: {
			enabled: true,
			lineWidth: 100,
			indentStyle: "tab",
		},
		organizeImports: {
			enabled: true,
		},
		linter: {
			enabled: true,
			rules: {
				recommended: true,
			},
		},
		css: {
			parser: {
				cssModules: false,
				allowWrongLineComments: true,
			},
		},
		javascript: {
			formatter: {
				quoteStyle: "double",
				trailingCommas: "all",
			},
		},
	};

	writeFile(join(projectPath, "biome.json"), JSON.stringify(biomeConfig, null, 2));
}

export function generateGitignore(projectPath: string) {
	const content = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Cloudflare
.wrangler/
.dev.vars

# Better Auth
packages/db/src/auth-schema.ts

# Misc
*.tsbuildinfo
`;

	writeFile(join(projectPath, ".gitignore"), content);
}

export function generateVSCodeSettings(projectPath: string) {
	const settings = {
		"editor.formatOnSave": true,
		"editor.defaultFormatter": "biomejs.biome",
		"editor.codeActionsOnSave": {
			"source.organizeImports.biome": "always",
			"source.fixAll.biome": "always",
		},
		"editor.tabSize": 2,
		"[typescript]": {
			"editor.defaultFormatter": "biomejs.biome",
		},
		"[typescriptreact]": {
			"editor.defaultFormatter": "biomejs.biome",
		},
		"[javascript]": {
			"editor.defaultFormatter": "biomejs.biome",
		},
		"[javascriptreact]": {
			"editor.defaultFormatter": "biomejs.biome",
		},
		"[json]": {
			"editor.defaultFormatter": "biomejs.biome",
		},
		"typescript.tsdk": "node_modules/typescript/lib",
	};

	writeFile(join(projectPath, ".vscode/settings.json"), JSON.stringify(settings, null, 2));

	const extensions = {
		recommendations: ["biomejs.biome", "dbaeumer.vscode-eslint", "bradlc.vscode-tailwindcss"],
	};

	writeFile(join(projectPath, ".vscode/extensions.json"), JSON.stringify(extensions, null, 2));
}

export function generateReadme(projectPath: string, config: ProjectConfig) {
	const content = `# ${config.name}

${config.description}

## Tech Stack

- **Package Manager**: ${config.packageManager === "bun" ? "Bun" : config.packageManager}
${config.includeBackend ? "- **Backend**: Cloudflare Workers + Hono" : ""}
${config.includeMcp ? "- **MCP Server**: Model Context Protocol with OAuth authentication" : ""}
${
	config.includeFrontend
		? `- **Frontend**: Vite + React 19 + TailwindCSS v4
  - **UI Components**: shadcn/ui ready (run \`npx shadcn@latest add\`)
  - **State Management**: TanStack Query
  - **Forms**: React Hook Form
  - **Animations**: Motion (Framer Motion successor)
  - **Icons**: Lucide React
  - **Charts**: Recharts
  - **Notifications**: Sonner
  - **Date Handling**: date-fns + react-day-picker
  - **Utilities**: clsx, tailwind-merge, class-variance-authority`
		: ""
}
${config.includeDatabase ? "- **Database**: Drizzle ORM + PostgreSQL" : ""}
${config.includeAuth ? "- **Auth**: Better Auth" : ""}
- **Linting/Formatting**: Biome

## Project Structure

\`\`\`
${config.name}/
├── apps/
${config.includeBackend ? "│   ├── backend/          # Cloudflare Workers API" : ""}
${config.includeFrontend ? "│   └── web/              # Vite + React frontend" : ""}
├── packages/
${config.includeDatabase ? "│   ├── db/               # Drizzle ORM schema" : ""}
│   └── utils/            # Shared utilities
${config.includeMcpWebComponents ? "│   └── web-components/   # ChatGPT widgets" : ""}
├── package.json
├── tsconfig.base.json
└── biome.json
\`\`\`

## Getting Started

1. Install dependencies:

\`\`\`bash
${config.packageManager} install
\`\`\`

${
	config.includeDatabase
		? `2. Set up environment variables:

\`\`\`bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your configuration
\`\`\`

3. Run database migrations:

\`\`\`bash
${config.packageManager} run db:migrate
\`\`\`

4. Start development server:
`
		: "2. Start development server:"
}

\`\`\`bash
${config.packageManager} run dev
\`\`\`

${
	config.includeBackend && config.includeFrontend
		? `
- Backend: http://localhost:8787
- Frontend: http://localhost:5173
`
		: config.includeBackend
			? "- Backend: http://localhost:8787"
			: config.includeFrontend
				? "- Frontend: http://localhost:5173"
				: ""
}

## Available Scripts

- \`${config.packageManager} run dev\` - Start development servers
- \`${config.packageManager} run build\` - Build for production
${config.includeDatabase ? `- \`${config.packageManager} run db:migrate\` - Run database migrations` : ""}
${config.includeAuth && config.includeDatabase ? `- \`${config.packageManager} run auth:generate\` - Generate Better Auth database schema` : ""}
- \`${config.packageManager} run lint\` - Check code quality
- \`${config.packageManager} run lint:fix\` - Fix linting issues
- \`${config.packageManager} run format\` - Format code
- \`${config.packageManager} run typecheck\` - Run TypeScript type checking
${config.includeMcpWebComponents ? `- \`${config.packageManager} --cwd packages/web-components run build:all\` - Build MCP web components` : ""}
${
	config.includeFrontend
		? `

## Using shadcn/ui

This project is pre-configured for shadcn/ui. To add components:

\`\`\`bash
npx shadcn@latest add button
npx shadcn@latest add card
# ... or any other component
\`\`\`

Components will be added to \`apps/web/src/components/ui/\`.

Learn more at [shadcn/ui](https://ui.shadcn.com)`
		: ""
}
${
	config.includeMcp
		? `

## MCP (Model Context Protocol) Server

This project includes an MCP server at \`/mcp\` for AI assistant integration.

${
	config.includeMcpOAuth
		? `### Authentication

The MCP server uses OAuth 2.0 for authentication:

1. Register an OAuth client through Better Auth
2. Obtain an access token via the OAuth flow
3. Connect to the MCP server with the Bearer token in the Authorization header

\`\`\`bash
# Example: Connect to MCP server
Authorization: Bearer {access_token}
\`\`\``
		: ""
}

### Available Tools

- \`get_user\` - Get current user information
- \`list_records\` - List example records
- \`create_record\` - Create a new record
${
	config.includeMcpOrganizations
		? `- \`list_organizations\` - List user organizations
- \`switch_organization\` - Change default organization`
		: ""
}

Add your own tools in \`apps/backend/src/mcp/tools.ts\`

### Resources

- \`doc://app/getting-started\` - Getting started guide
${config.includeMcpWebComponents ? "- `ui://widget/example.html` - Example interactive widget" : ""}

${
	config.includeMcpWebComponents
		? `### Web Components (ChatGPT Integration)

Build interactive widgets for ChatGPT:

\`\`\`bash
${config.packageManager} --cwd packages/web-components run build:all
\`\`\`

Widgets are exposed as MCP resources with \`ui://widget/\` URIs.`
		: ""
}`
		: ""
}

## License

MIT
`;

	writeFile(join(projectPath, "README.md"), content);
}
