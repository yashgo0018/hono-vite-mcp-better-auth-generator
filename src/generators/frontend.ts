import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateFrontend(
	projectPath: string,
	config: ProjectConfig,
	versions: Map<string, string>,
) {
	const webPath = join(projectPath, "apps/web");
	createDirectory(webPath);
	createDirectory(join(webPath, "src"));
	createDirectory(join(webPath, "src/components"));
	createDirectory(join(webPath, "src/lib"));
	createDirectory(join(webPath, "public"));

	// package.json
	const deps: Record<string, string> = {
		[`@${config.name}/utils`]: "workspace:*",
		react: "catalog:",
		"react-dom": "catalog:",
		"react-router-dom": versions.get("react-router-dom") || "^7.13.0",
	};

	if (config.includeBackend) {
		deps.hono = versions.get("hono") || "^4.11.7";
	}

	if (config.includeAuth) {
		deps["better-auth"] = versions.get("better-auth") || "^1.3.12";
	}

	const packageJson = {
		name: `@${config.name}/web`,
		type: "module",
		scripts: {
			dev: "vite",
			build: "vite build",
			preview: "vite preview",
		},
		dependencies: deps,
		devDependencies: {
			"@tailwindcss/vite": "catalog:",
			"@types/react": "catalog:",
			"@types/react-dom": "catalog:",
			"@vitejs/plugin-react": "catalog:",
			typescript: "catalog:",
			vite: "catalog:",
		},
	};

	writeFile(join(webPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src", "vite.config.ts"],
		compilerOptions: {
			baseUrl: ".",
			paths: {
				"@/*": ["src/*"],
			},
		},
	};

	writeFile(join(webPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// vite.config.ts
	const viteConfig = generateViteConfig(config);
	writeFile(join(webPath, "vite.config.ts"), viteConfig);

	// index.html
	const indexHtml = generateIndexHtml(config);
	writeFile(join(webPath, "index.html"), indexHtml);

	// src/main.tsx
	const mainTsx = generateMainTsx(config);
	writeFile(join(webPath, "src/main.tsx"), mainTsx);

	// src/App.tsx
	const appTsx = generateAppTsx(config);
	writeFile(join(webPath, "src/App.tsx"), appTsx);

	// src/index.css
	const indexCss = generateIndexCss();
	writeFile(join(webPath, "src/index.css"), indexCss);

	// src/env.ts
	const envTs = generateFrontendEnv(config);
	writeFile(join(webPath, "src/env.ts"), envTs);

	if (config.includeBackend) {
		// src/api.ts
		const apiTs = generateApiClient(config);
		writeFile(join(webPath, "src/api.ts"), apiTs);
	}

	if (config.includeAuth) {
		// src/auth.ts
		const authTs = generateAuthClient(config);
		writeFile(join(webPath, "src/auth.ts"), authTs);
	}

	// .env.example
	const envExample = generateFrontendEnvExample(config);
	writeFile(join(webPath, ".env.example"), envExample);

	// public/favicon.ico (placeholder)
	writeFile(join(webPath, "public/favicon.ico"), "");
}

function generateViteConfig(config: ProjectConfig): string {
	return `import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	server: {
		port: 5173,
	},
});
`;
}

function generateIndexHtml(config: ProjectConfig): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<link rel="icon" type="image/x-icon" href="/favicon.ico" />
		<title>${config.name}</title>
	</head>
	<body>
		<div id="root"></div>
		<script type="module" src="/src/main.tsx"></script>
	</body>
</html>
`;
}

function generateMainTsx(config: ProjectConfig): string {
	return `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
`;
}

function generateAppTsx(config: ProjectConfig): string {
	return `function App() {
	return (
		<div className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center">
			<div className="text-center space-y-4">
				<h1 className="text-4xl font-bold">${config.name}</h1>
				<p className="text-gray-400">${config.description || "Welcome to your new project!"}</p>
				<div className="flex gap-4 justify-center mt-8">
					<a
						href="https://vitejs.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
					>
						Vite Docs
					</a>
					<a
						href="https://react.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
					>
						React Docs
					</a>
					${
						config.includeBackend
							? `
					<a
						href="https://hono.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition"
					>
						Hono Docs
					</a>`
							: ""
					}
				</div>
			</div>
		</div>
	);
}

export default App;
`;
}

function generateIndexCss(): string {
	return `@import "tailwindcss";

:root {
	font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
	line-height: 1.5;
	font-weight: 400;

	color-scheme: dark;

	font-synthesis: none;
	text-rendering: optimizeLegibility;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

* {
	box-sizing: border-box;
}

body {
	margin: 0;
	min-height: 100vh;
}
`;
}

function generateFrontendEnv(config: ProjectConfig): string {
	const fields: string[] = [];

	if (config.includeBackend) {
		fields.push(
			`	VITE_API_ORIGIN: z.string().url().default("http://localhost:8787")`,
		);
	}

	return `import { z } from "zod";

const envSchema = z.object({
${fields.join(",\n")}
});

export const env = envSchema.parse(import.meta.env);
`;
}

function generateApiClient(config: ProjectConfig): string {
	return `import type { AppType } from "@${config.name}/backend";
import { hc } from "hono/client";
import { env } from "./env";

export const api = hc<AppType>(env.VITE_API_ORIGIN, {
	init: {
		credentials: "include",
	},
});
`;
}

function generateAuthClient(config: ProjectConfig): string {
	return `import { createAuthClient } from "better-auth/client";
import { env } from "./env";

export const authClient = createAuthClient({
	baseURL: env.VITE_API_ORIGIN,
	fetch: (input, init) => {
		return fetch(input, {
			...init,
			credentials: "include",
		});
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
`;
}

function generateFrontendEnvExample(config: ProjectConfig): string {
	const vars: string[] = [];

	if (config.includeBackend) {
		vars.push(`VITE_API_ORIGIN=http://localhost:8787`);
	}

	return vars.join("\n") + "\n";
}
