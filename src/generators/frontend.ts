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

		// Core React & Routing
		react: "catalog:",
		"react-dom": "catalog:",
		"react-router-dom": versions.get("react-router-dom") || "^7.13.0",

		// Icons & Charts
		"lucide-react": "catalog:",
		recharts: "catalog:",

		// Data Fetching & Forms
		"@tanstack/react-query": versions.get("@tanstack/react-query") || "^5.90.20",
		"react-hook-form": versions.get("react-hook-form") || "^7.71.1",

		// UI Utilities
		clsx: versions.get("clsx") || "^2.1.1",
		"tailwind-merge": versions.get("tailwind-merge") || "^3.4.0",
		"class-variance-authority": versions.get("class-variance-authority") || "^0.7.1",

		// Animations & Interactions
		motion: versions.get("motion") || "^12.31.0",
		sonner: versions.get("sonner") || "^2.0.7",
		cmdk: versions.get("cmdk") || "^1.1.1",

		// Date Handling
		"date-fns": versions.get("date-fns") || "^4.1.0",
		"react-day-picker": versions.get("react-day-picker") || "^9.13.0",

		// shadcn/ui dependencies
		"@radix-ui/react-slot": versions.get("@radix-ui/react-slot") || "^1.2.4",
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
			tailwindcss: "catalog:",
			autoprefixer: versions.get("autoprefixer") || "^10.4.24",
			postcss: versions.get("postcss") || "^8.5.6",
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

	// postcss.config.js
	const postcssConfig = `export default {
	plugins: {
		tailwindcss: {},
		autoprefixer: {},
	},
};
`;
	writeFile(join(webPath, "postcss.config.js"), postcssConfig);

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

	// src/lib/utils.ts (shadcn/ui utility)
	const utilsTs = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
`;
	writeFile(join(webPath, "src/lib/utils.ts"), utilsTs);

	// components.json (shadcn/ui config)
	const componentsConfig = {
		$schema: "https://ui.shadcn.com/schema.json",
		style: "new-york",
		rsc: false,
		tsx: true,
		tailwind: {
			config: "tailwind.config.ts",
			css: "src/index.css",
			baseColor: "neutral",
			cssVariables: true,
		},
		aliases: {
			components: "@/components",
			utils: "@/lib/utils",
			ui: "@/components/ui",
			lib: "@/lib",
			hooks: "@/hooks",
		},
	};
	writeFile(join(webPath, "components.json"), JSON.stringify(componentsConfig, null, 2));

	// .env.example
	const envExample = generateFrontendEnvExample(config);
	writeFile(join(webPath, ".env.example"), envExample);

	// OAuth consent page
	if (config.includeMcpOAuth) {
		createDirectory(join(webPath, "src/pages"));

		const consentPageTsx = generateOAuthConsentPage(config);
		writeFile(join(webPath, "src/pages/consent.tsx"), consentPageTsx);
	}

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
	const homeContent = `\t\t<div className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center">
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
		</div>`;

	if (config.includeMcpOAuth) {
		return `import { BrowserRouter, Routes, Route } from "react-router-dom";
import ConsentPage from "./pages/consent";

function Home() {
	return (
${homeContent}
	);
}

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/consent" element={<ConsentPage />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
`;
	}

	return `function App() {
	return (
${homeContent}
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
	const plugins = [];
	const pluginImports = [];

	if (config.includeOrganizations) {
		pluginImports.push(
			`import { organizationClient } from "better-auth/plugins/organization/client";`,
		);
		plugins.push("organizationClient()");
	}

	if (config.includeMcpOAuth) {
		pluginImports.push(`import { oauthProviderClient } from "@better-auth/oauth-provider/client";`);
		plugins.push("oauthProviderClient()");
	}

	return `import { createAuthClient } from "better-auth/client";
${pluginImports.join("\n")}
import { env } from "./env";

export const authClient = createAuthClient({${plugins.length > 0 ? `\n\tplugins: [${plugins.join(", ")}],` : ""}
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

function generateOAuthConsentPage(config: ProjectConfig): string {
	return `import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authClient } from "@/auth";

export default function ConsentPage() {
	const [searchParams] = useSearchParams();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const clientId = searchParams.get("client_id");
	const scope = searchParams.get("scope");
	const redirectUri = searchParams.get("redirect_uri");
	const state = searchParams.get("state");

	const handleApprove = async () => {
		setLoading(true);
		setError(null);

		try {
			// Call Better Auth OAuth consent endpoint
			const response = await authClient.oauth.authorize({
				clientId: clientId!,
				scope: scope || "",
				redirectUri: redirectUri!,
				state: state || undefined,
				allow: true,
			});

			if (response.redirectUri) {
				window.location.href = response.redirectUri;
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to authorize");
		} finally {
			setLoading(false);
		}
	};

	const handleDeny = async () => {
		setLoading(true);

		try {
			const response = await authClient.oauth.authorize({
				clientId: clientId!,
				scope: scope || "",
				redirectUri: redirectUri!,
				state: state || undefined,
				allow: false,
			});

			if (response.redirectUri) {
				window.location.href = response.redirectUri;
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to deny");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center p-4">
			<div className="max-w-md w-full bg-gray-900 rounded-lg p-8 space-y-6">
				<div>
					<h1 className="text-2xl font-bold">Authorize Application</h1>
					<p className="text-gray-400 mt-2">
						An application is requesting access to your ${config.name} account.
					</p>
				</div>

				<div className="space-y-2">
					<div>
						<span className="text-sm text-gray-500">Client ID:</span>
						<p className="font-mono text-sm">{clientId}</p>
					</div>

					{scope && (
						<div>
							<span className="text-sm text-gray-500">Requested Scopes:</span>
							<p className="font-mono text-sm">{scope}</p>
						</div>
					)}
				</div>

				{error && (
					<div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-red-400 text-sm">
						{error}
					</div>
				)}

				<div className="flex gap-3">
					<button
						onClick={handleApprove}
						disabled={loading}
						className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition"
					>
						{loading ? "Loading..." : "Approve"}
					</button>

					<button
						onClick={handleDeny}
						disabled={loading}
						className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 px-4 py-2 rounded-lg font-medium transition"
					>
						Deny
					</button>
				</div>
			</div>
		</div>
	);
}
`;
}
