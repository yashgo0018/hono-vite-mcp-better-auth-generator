import { join } from "path";
import type { ProjectConfig } from "../types";
import { writeFile } from "../utils/file-utils";

export function generateRootPackageJson(projectPath: string, config: ProjectConfig) {
	const catalog: Record<string, string> = {
		"@cloudflare/workers-types": "^4.20260131.0",
		typescript: "^5.9.3",
		zod: "^4.3.6",
	};

	if (config.includeFrontend) {
		catalog["@tailwindcss/vite"] = "^4.1.18";
		catalog["@types/react"] = "^19.2.10";
		catalog.react = "^19.2.4";
		catalog["react-dom"] = "^19.2.4";
		catalog.vite = "^7.3.1";
		catalog["@vitejs/plugin-react"] = "^6.0.1";
	}

	const packageJson = {
		name: config.name,
		private: true,
		description: config.description,
		author: config.author,
		packageManager: config.packageManager === "bun" ? "bun@1.2.18" : undefined,
		workspaces: {
			packages: ["apps/*", "packages/*"],
			catalog,
		},
		scripts: {
			dev: config.includeBackend && config.includeFrontend
				? `wrangler dev --config apps/backend/wrangler.toml & ${config.packageManager} --cwd apps/web dev`
				: config.includeBackend
					? "wrangler dev --config apps/backend/wrangler.toml"
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
		$schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
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
.vscode/
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

# Misc
*.tsbuildinfo
`;

	writeFile(join(projectPath, ".gitignore"), content);
}

export function generateReadme(projectPath: string, config: ProjectConfig) {
	const content = `# ${config.name}

${config.description}

## Tech Stack

- **Package Manager**: ${config.packageManager === "bun" ? "Bun" : config.packageManager}
${config.includeBackend ? "- **Backend**: Cloudflare Workers + Hono" : ""}
${config.includeFrontend ? "- **Frontend**: Vite + React 19" : ""}
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

## License

MIT
`;

	writeFile(join(projectPath, "README.md"), content);
}
