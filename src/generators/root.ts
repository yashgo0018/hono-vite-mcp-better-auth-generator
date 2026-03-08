import { join } from "path";
import type { ProjectConfig } from "../types";
import { writeFile } from "../utils/file-utils";
import { rootGitignore } from "../gitignore";

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
			dev: (() => {
				const webDevCmd =
					config.packageManager === "bun" ? "bun --cwd apps/web dev"
						: config.packageManager === "npm" ? "npm --prefix apps/web run dev"
							: config.packageManager === "pnpm" ? "pnpm --dir apps/web dev"
								: `yarn --cwd apps/web dev`;
				if (config.includeBackend && config.includeFrontend)
					return `wrangler dev --config apps/backend/wrangler.json & ${webDevCmd}`;
				if (config.includeBackend) return "wrangler dev --config apps/backend/wrangler.json";
				if (config.includeFrontend) return webDevCmd;
				return undefined;
			})(),
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
					? `cd ./apps/backend && ${config.packageManager === "bun" ? "bunx" : "npx"} @better-auth/cli generate -y --config ./src/auth-with-env.ts --output ../../packages/db/src/auth-schema.ts`
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
		},
		formatter: {
			enabled: true,
			lineWidth: 100,
			indentStyle: "space",
			indentWidth: 2,
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
				tailwindDirectives: true
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
	writeFile(join(projectPath, ".gitignore"), rootGitignore);
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
		recommendations: ["biomejs.biome", "bradlc.vscode-tailwindcss"],
	};

	writeFile(join(projectPath, ".vscode/extensions.json"), JSON.stringify(extensions, null, 2));
}

export function generateReadme(projectPath: string, config: ProjectConfig) {
	const pm = config.packageManager;
	const npx = pm === "bun" ? "bunx" : "npx";

	// ── Tech Stack ──────────────────────────────────────────────────────────────
	const techStack = [
		`- **Package Manager**: ${pm === "bun" ? "Bun" : pm}`,
		config.includeBackend && "- **Backend**: Cloudflare Workers + Hono",
		config.includeMcp &&
			`- **MCP Server**: Model Context Protocol${config.includeMcpOAuth ? " with OAuth 2.0" : ""}`,
		config.includeFrontend &&
			`- **Frontend**: Vite + React 19 + TailwindCSS v4
  - **UI Components**: shadcn/ui ready (run \`npx shadcn@latest add\`)
  - **State Management**: TanStack Query
  - **Forms**: React Hook Form
  - **Animations**: Motion (Framer Motion successor)
  - **Icons**: Lucide React
  - **Charts**: Recharts
  - **Notifications**: Sonner
  - **Date Handling**: date-fns + react-day-picker
  - **Utilities**: clsx, tailwind-merge, class-variance-authority`,
		config.includeDatabase && "- **Database**: Drizzle ORM + PostgreSQL (Cloudflare Hyperdrive)",
		config.includeAuth &&
			`- **Auth**: Better Auth${config.includeGoogleAuth ? " + Google OAuth" : ""}${config.includeOrganizations ? " + Organizations" : ""}`,
		"- **Linting/Formatting**: Biome",
	]
		.filter(Boolean)
		.join("\n");

	// ── Project Structure ────────────────────────────────────────────────────────
	const webTree = config.includeFrontend
		? config.includeAuth
			? `│   └── web/              # Vite + React frontend
│       └── src/
│           ├── context/      # AuthContext & AuthProvider
│           ├── routes/       # Page routes (auth/, dashboard/)
│           └── components/   # Navbar + shared components`
			: "│   └── web/              # Vite + React frontend"
		: "";

	const projectTree = [
		`${config.name}/`,
		"├── apps/",
		config.includeBackend && "│   ├── backend/          # Cloudflare Workers API",
		config.includeFrontend && webTree,
		"├── packages/",
		config.includeDatabase && "│   ├── db/               # Drizzle ORM schema + migrations",
		"│   └── utils/            # Shared utilities",
		config.includeMcpWebComponents && "│   └── web-components/   # ChatGPT interactive widgets",
		"├── package.json",
		"├── tsconfig.base.json",
		"└── biome.json",
	]
		.filter(Boolean)
		.join("\n");

	// ── Getting Started ──────────────────────────────────────────────────────────
	const needsEnv = config.includeDatabase || config.includeAuth;
	const needsAuthGenerate = config.includeAuth && config.includeDatabase;

	let gettingStartedSteps = `1. Install dependencies:\n\n\`\`\`bash\n${pm} install\n\`\`\`\n`;

	if (needsEnv) {
		const envStep = needsAuthGenerate ? 2 : 2;
		gettingStartedSteps += `
${envStep}. Set up environment variables:

\`\`\`bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your database URL${config.includeGoogleAuth ? ", Google OAuth credentials," : ""} and other secrets
\`\`\`
`;
		if (config.includeGoogleAuth) {
			gettingStartedSteps += `
   > **Google OAuth**: Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   > Set **Authorized redirect URIs** to \`http://localhost:8787/api/auth/callback/google\`.
   > Copy **Client ID** and **Client Secret** into \`.env\`.
`;
		}

		if (needsAuthGenerate) {
			gettingStartedSteps += `
3. Generate the Better Auth database schema:

\`\`\`bash
${pm} run auth:generate
\`\`\`

4. Run database migrations:

\`\`\`bash
${pm} run db:migrate
\`\`\`

5. Start development server:
`;
		} else {
			gettingStartedSteps += `
3. Run database migrations:

\`\`\`bash
${pm} run db:migrate
\`\`\`

4. Start development server:
`;
		}
	} else {
		gettingStartedSteps += "\n2. Start development server:\n";
	}

	gettingStartedSteps += `
\`\`\`bash
${pm} run dev
\`\`\`
`;

	if (config.includeBackend && config.includeFrontend) {
		gettingStartedSteps += "\n- Backend: http://localhost:8787\n- Frontend: http://localhost:5173\n";
	} else if (config.includeBackend) {
		gettingStartedSteps += "\n- Backend: http://localhost:8787\n";
	} else if (config.includeFrontend) {
		gettingStartedSteps += "\n- Frontend: http://localhost:5173\n";
	}

	// ── Available Scripts ────────────────────────────────────────────────────────
	const scripts = [
		`- \`${pm} run dev\` - Start development servers`,
		`- \`${pm} run build\` - Build for production`,
		needsAuthGenerate &&
			`- \`${pm} run auth:generate\` - Generate Better Auth database schema from your auth config`,
		config.includeDatabase && `- \`${pm} run db:migrate\` - Run database migrations`,
		`- \`${pm} run lint\` - Check code quality`,
		`- \`${pm} run lint:fix\` - Fix linting issues`,
		`- \`${pm} run format\` - Format code`,
		`- \`${pm} run typecheck\` - Run TypeScript type checking`,
		config.includeMcpWebComponents &&
			`- \`${pm} --cwd packages/web-components run build:all\` - Build MCP web components`,
	]
		.filter(Boolean)
		.join("\n");

	// ── Auth Section ─────────────────────────────────────────────────────────────
	const authSection =
		config.includeAuth && config.includeFrontend
			? `
## Authentication

Better Auth is configured in \`apps/backend/src/auth.ts\`.

### Pages

| Route | Description |
|-------|-------------|
| \`/auth/login\` | Sign in with email/password${config.includeGoogleAuth ? " or Google" : ""} |
| \`/auth/signup\` | Create a new account${config.includeGoogleAuth ? " or sign up with Google" : ""} |
| \`/dashboard\` | Protected — requires authentication |

### How it works

- \`AuthProvider\` (in \`src/context/auth.tsx\`) fetches the session on mount and listens for session changes.
- \`AuthGuard\` (in \`src/routes/layouts/AuthGuard.tsx\`) redirects unauthenticated users to \`/auth/login\` and authenticated users away from auth pages.
- The \`Navbar\` shows **Sign in / Get started** links when logged out and **Dashboard / Sign out** when logged in.
${
	config.includeGoogleAuth
		? `
### Google OAuth

Set these variables in \`apps/backend/.env\`:

\`\`\`env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
\`\`\`

Authorized redirect URI: \`{BACKEND_URL}/api/auth/callback/google\`
`
		: ""
}`
			: "";

	// ── Organizations Section ────────────────────────────────────────────────────
	const orgsSection = config.includeOrganizations
		? `
## Organizations

Organizations are enabled via Better Auth's \`organization()\` plugin.

- Users can belong to multiple organizations with role-based access (owner / admin / member).
- The active organization is tracked per-session.
${config.includeMcp ? "- MCP tools `list_organizations` and `switch_organization` are available for AI assistant access." : ""}

Manage organizations through the Better Auth client:

\`\`\`ts
import { authClient } from "@/lib/auth-client";

const { data } = await authClient.organization.list();
await authClient.organization.setActive({ organizationId: "..." });
\`\`\`
`
		: "";

	// ── shadcn/ui Section ────────────────────────────────────────────────────────
	const shadcnSection = config.includeFrontend
		? `
## Using shadcn/ui

This project is pre-configured for shadcn/ui. To add components:

\`\`\`bash
${npx} shadcn@latest add button
${npx} shadcn@latest add card
\`\`\`

Components will be added to \`apps/web/src/components/ui/\`.

Learn more at [shadcn/ui](https://ui.shadcn.com)`
		: "";

	// ── MCP Section ──────────────────────────────────────────────────────────────
	const mcpSection = config.includeMcp
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

\`\`\`
Authorization: Bearer {access_token}
\`\`\``
		: ""
}

### Available Tools

- \`get_user\` - Get current user information
- \`list_records\` - List example records
- \`create_record\` - Create a new record
${
	config.includeOrganizations
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
${pm} --cwd packages/web-components run build:all
\`\`\`

Widgets are exposed as MCP resources with \`ui://widget/\` URIs.`
		: ""
}`
		: "";

	const content = `# ${config.name}

${config.description}

## Tech Stack

${techStack}

## Project Structure

\`\`\`
${projectTree}
\`\`\`

## Getting Started

${gettingStartedSteps}

## Available Scripts

${scripts}
${authSection}
${orgsSection}
${shadcnSection}
${mcpSection}

## License

MIT
`;

	writeFile(join(projectPath, "README.md"), content);
}
