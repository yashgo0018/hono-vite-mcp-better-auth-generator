import { join } from "path";
import type { ProjectConfig } from "../../types";
import { createDirectory, writeFile } from "../../utils/file-utils";
import { webComponentsGitignore } from "../../gitignore";

export function generateMcpWebComponents(
  projectPath: string,
  config: ProjectConfig,
  versions: Map<string, string>,
) {
  if (!config.includeMcpWebComponents) return;

  const webComponentsPath = join(projectPath, "packages/web-components");
  createDirectory(webComponentsPath);
  writeFile(join(webComponentsPath, ".gitignore"), webComponentsGitignore);
  createDirectory(join(webComponentsPath, "src"));
  createDirectory(join(webComponentsPath, "src/components"));
  createDirectory(join(webComponentsPath, "src/utils"));
  createDirectory(join(webComponentsPath, "src/types"));

  // package.json
  const packageJson = {
    name: `@${config.name}/web-components`,
    private: true,
    type: "module",
    main: "dist/index.ts",
    scripts: {
      dev: "vite",
      "build:example":
        "WIDGET_NAME=example-widget WIDGET_ENTRY=src/example-widget-entry.tsx vite build",
      "build:all": `${config.packageManager} run build:example`,
      preview: "vite preview",
      serve: "vite preview --port 4444 --strictPort",
    },
    dependencies: {
      "@radix-ui/react-slot": "catalog:",
      "@tailwindcss/vite": "catalog:",
      "@tanstack/react-table": versions.get("@tanstack/react-table") || "^8.21.3",
      "class-variance-authority": versions.get("class-variance-authority") || "^0.7.1",
      clsx: versions.get("clsx") || "^2.1.1",
      jose: versions.get("jose") || "^6.1.0",
      "lucide-react": "catalog:",
      react: "catalog:",
      "react-dom": "catalog:",
      recharts: "catalog:",
      "tailwind-merge": versions.get("tailwind-merge") || "^3.4.0",
      tailwindcss: "catalog:",
    },
    devDependencies: {
      "@types/react": "catalog:",
      "@types/react-dom": "catalog:",
      "@vitejs/plugin-react": "catalog:",
      "tw-animate-css": versions.get("tw-animate-css") || "^1.4.0",
      typescript: "catalog:",
      vite: "catalog:",
    },
    exports: {
      ".": {
        types: "./dist/index.ts",
        import: "./dist/index.ts",
      },
    },
  };

  writeFile(join(webComponentsPath, "package.json"), JSON.stringify(packageJson, null, 2));

  // tsconfig.json
  const tsConfig = {
    extends: "../../tsconfig.base.json",
    include: ["src"],
    compilerOptions: {
      paths: {
        "@/*": ["./src/*"],
      },
    },
  };

  writeFile(join(webComponentsPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

  // vite.config.ts
  const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			input: process.env.WIDGET_ENTRY || "src/example-widget-entry.tsx",
			output: {
				format: "iife",
				entryFileNames: \`\${process.env.WIDGET_NAME || "example-widget"}.js\`,
			},
		},
	},
});
`;

  writeFile(join(webComponentsPath, "vite.config.ts"), viteConfig);

  // index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${config.name} - Web Components Dev</title>
	</head>
	<body>
		<div id="root"></div>
		<script type="module" src="/src/dev-preview.tsx"></script>
	</body>
</html>
`;

  writeFile(join(webComponentsPath, "index.html"), indexHtml);

  // .env.example
  const envExample = config.includeMcpOAuth
    ? `# MCP Server Configuration
VITE_APP_URL=http://localhost:5173
VITE_MCP_SERVER_URL=http://localhost:8787/mcp

# JWT Configuration for Development
# Generate RS256 key pair:
# openssl genrsa -out private.pem 2048
# openssl rsa -in private.pem -pubout -out public.pem
# Then paste the private key here (with \\n for newlines):
VITE_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"

# User ID for testing (create a user first)
VITE_USER_ID=YOUR_USER_ID_HERE
`
    : `# MCP Server Configuration
VITE_APP_URL=http://localhost:5173
VITE_MCP_SERVER_URL=http://localhost:8787/mcp

# User ID for testing (create a user first)
VITE_USER_ID=YOUR_USER_ID_HERE
`;

  writeFile(join(webComponentsPath, ".env.example"), envExample);

  // src/types/openai.ts
  const openaiTypes = generateOpenAiTypes();
  writeFile(join(webComponentsPath, "src/types/openai.ts"), openaiTypes);

  // src/utils/sse.ts
  const sseUtils = generateSseUtils();
  writeFile(join(webComponentsPath, "src/utils/sse.ts"), sseUtils);

  // src/dev-preview.tsx
  const devPreview = generateDevPreview(config);
  writeFile(join(webComponentsPath, "src/dev-preview.tsx"), devPreview);

  // src/example-widget-entry.tsx
  const exampleWidgetEntry = `import React from "react";
import ReactDOM from "react-dom/client";
import ExampleWidget from "./components/ExampleWidget";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ExampleWidget />
	</React.StrictMode>,
);
`;

  writeFile(join(webComponentsPath, "src/example-widget-entry.tsx"), exampleWidgetEntry);

  // src/components/ExampleWidget.tsx
  const exampleWidget = `import { useState } from "react";

export default function ExampleWidget() {
	const [count, setCount] = useState(0);

	return (
		<div style={{ padding: "20px", fontFamily: "system-ui" }}>
			<h1>Example Widget</h1>
			<p>This is a basic example widget for ChatGPT integration.</p>
			<button
				onClick={() => setCount(count + 1)}
				style={{
					padding: "10px 20px",
					backgroundColor: "#0066cc",
					color: "white",
					border: "none",
					borderRadius: "4px",
					cursor: "pointer",
				}}
			>
				Count: {count}
			</button>
			<p style={{ marginTop: "10px", color: "#666" }}>
				Customize this widget in packages/web-components/src/components/ExampleWidget.tsx
			</p>
		</div>
	);
}
`;

  writeFile(join(webComponentsPath, "src/components/ExampleWidget.tsx"), exampleWidget);
}

function generateOpenAiTypes(): string {
  return `export type DisplayMode = "pip" | "inline" | "fullscreen";

export type Theme = "light" | "dark";

export type UserAgent = "chatgpt-mobile" | "chatgpt-desktop";

export type SafeArea = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export type API = {
	callTool: <TInput = unknown, TOutput = unknown>(options: {
		toolName: string;
		parameters: TInput;
	}) => Promise<TOutput>;

	sendFollowUpMessage: (message: string) => Promise<void>;

	openExternal: (url: string) => Promise<void>;

	updateContentSize: (size: { width: number; height: number }) => Promise<void>;

	requestDisplayMode: (displayMode: DisplayMode) => Promise<void>;

	close: () => Promise<void>;

	toolOutput?: unknown;
};

export type OpenAiGlobals = {
	api: API;

	displayMode: DisplayMode;

	safeArea: SafeArea;

	theme: Theme;

	userAgent: UserAgent;
};

declare global {
	interface Window {
		openai?: OpenAiGlobals;
	}
}

export {};
`;
}

function generateSseUtils(): string {
  return `/**
 * Parse Server-Sent Events response and extract JSON data
 */
export async function parseSSEResponse<T = unknown>(response: Response): Promise<T> {
	const text = await response.text();
	const lines = text.split("\\n");
	const dataLines = lines.filter((line) => line.startsWith("data: "));

	if (dataLines.length === 0) {
		throw new Error("No data in SSE response");
	}

	const lastDataLine = dataLines[dataLines.length - 1];
	const jsonString = lastDataLine.substring(6); // Remove "data: " prefix

	return JSON.parse(jsonString) as T;
}
`;
}

function generateDevPreview(config: ProjectConfig): string {
  const hasOAuth = config.includeMcpOAuth;
  const hasOrganizations = config.includeOrganizations;

  const jwtImport = hasOAuth ? `import * as jose from "jose";` : "";
  const sessionIdHeader = `const SESSION_ID_HEADER = "mcp-session-id";`;

  const jwtSigningCode = hasOAuth
    ? `
	// Generate JWT access token for OAuth
	const privateKey = await jose.importPKCS8(import.meta.env.VITE_JWT_PRIVATE_KEY, "RS256");
	const token = await new jose.SignJWT({ sub: userId })
		.setProtectedHeader({ alg: "RS256", kid: "main" })
		.setIssuedAt()
		.setIssuer(appUrl)
		.setAudience(mcpServerUrl)
		.setExpirationTime("24h")
		.sign(privateKey);

	return token;`
    : `
	// Simple bearer token (no OAuth)
	return "dev-token-" + userId;`;

  const organizationFields = hasOrganizations
    ? `
	const [organizationId, setOrganizationId] = useState("");`
    : "";

  const organizationFormFields = hasOrganizations
    ? `
				<div>
					<label className="block text-sm font-medium text-gray-300 mb-2">
						Organization ID (optional)
					</label>
					<input
						type="text"
						value={organizationId}
						onChange={(e) => setOrganizationId(e.target.value)}
						placeholder="org-xxx"
						className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>`
    : "";

  return `import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
${jwtImport}
import { parseSSEResponse } from "./utils/sse";
import type { OpenAiGlobals } from "./types/openai";
import ExampleWidget from "./components/ExampleWidget";

${sessionIdHeader}

// Widget registry - add your components here
type ComponentKey = "example-widget";

type ComponentConfig = {
	name: string;
	component: React.ComponentType;
	toolName: string;
	toolArgs: Record<string, unknown>;
};

const COMPONENTS: Record<ComponentKey, ComponentConfig> = {
	"example-widget": {
		name: "Example Widget",
		component: ExampleWidget,
		toolName: "get_user",
		toolArgs: {},
	},
};

let mcpSessionId: string | null = null;

async function generateAccessToken(userId: string, appUrl: string, mcpServerUrl: string) {${jwtSigningCode}
}

async function initializeMCPSession(
	accessToken: string,
	mcpServerUrl: string,
	userId: string${hasOrganizations ? `,\n\torganizationId?: string` : ""},
) {
	const response = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {
					roots: {
						listChanged: true,
					},
					sampling: {},
				},
				clientInfo: {
					name: "${config.name}-mcp-dev",
					version: "1.0.0",
				},
			},
		}),
	});

	if (!response.ok) {
		throw new Error(\`Failed to initialize MCP session: \${response.statusText}\`);
	}

	mcpSessionId = response.headers.get(SESSION_ID_HEADER);

	if (!mcpSessionId) {
		throw new Error("No session ID returned from MCP server");
	}

	// Send initialized notification
	const notifyResponse = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
			[SESSION_ID_HEADER]: mcpSessionId,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			method: "notifications/initialized",
		}),
	});

	if (!notifyResponse.ok) {
		throw new Error(\`Failed to send initialized notification: \${notifyResponse.statusText}\`);
	}

	return mcpSessionId;
}

async function callMcpTool(
	accessToken: string,
	mcpServerUrl: string,
	sessionId: string,
	toolName: string,
	args: Record<string, unknown>,
) {
	const response = await fetch(mcpServerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: \`Bearer \${accessToken}\`,
			[SESSION_ID_HEADER]: sessionId,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: Date.now(),
			method: "tools/call",
			params: {
				name: toolName,
				arguments: args,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(\`Failed to call tool: \${response.statusText}\`);
	}

	const data = await parseSSEResponse(response);
	return data;
}

function DevPreview() {
	const [initialized, setInitialized] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [userId, setUserId] = useState(import.meta.env.VITE_USER_ID || "");${organizationFields}
	const [selectedComponent, setSelectedComponent] = useState<ComponentKey>("example-widget");
	const [accessToken, setAccessToken] = useState<string | null>(null);

	const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:5173";
	const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:8787/mcp";

	const handleInitialize = async () => {
		if (!userId) {
			setError("User ID is required");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Generate access token
			const token = await generateAccessToken(userId, appUrl, mcpServerUrl);
			setAccessToken(token);

			// Initialize MCP session
			await initializeMCPSession(
				token,
				mcpServerUrl,
				userId${hasOrganizations ? `,\n\t\t\t\torganizationId || undefined` : ""},
			);

			setInitialized(true);

			// Mock OpenAI globals for development
			window.openai = {
				api: {
					callTool: async ({ toolName, parameters }) => {
						if (!mcpSessionId || !token) {
							throw new Error("MCP session not initialized");
						}

						const result = await callMcpTool(token, mcpServerUrl, mcpSessionId, toolName, parameters);
						window.openai!.api.toolOutput = result;
						return result;
					},
					sendFollowUpMessage: async (message: string) => {
						console.log("Follow-up message:", message);
					},
					openExternal: async (url: string) => {
						window.open(url, "_blank");
					},
					updateContentSize: async (size) => {
						console.log("Update content size:", size);
					},
					requestDisplayMode: async (mode) => {
						console.log("Request display mode:", mode);
					},
					close: async () => {
						console.log("Close");
					},
				},
				displayMode: "fullscreen",
				safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
				theme: "dark",
				userAgent: "chatgpt-desktop",
			} as OpenAiGlobals;

			// Call initial tool to populate data
			const componentConfig = COMPONENTS[selectedComponent];
			if (componentConfig) {
				const result = await callMcpTool(
					token,
					mcpServerUrl,
					mcpSessionId!,
					componentConfig.toolName,
					componentConfig.toolArgs,
				);
				window.openai!.api.toolOutput = result;
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to initialize MCP session");
		} finally {
			setLoading(false);
		}
	};

	const handleComponentChange = async (key: ComponentKey) => {
		setSelectedComponent(key);

		// Load data for the new component
		if (initialized && accessToken && mcpSessionId) {
			const componentConfig = COMPONENTS[key];
			if (componentConfig) {
				try {
					const result = await callMcpTool(
						accessToken,
						mcpServerUrl,
						mcpSessionId,
						componentConfig.toolName,
						componentConfig.toolArgs,
					);
					window.openai!.api.toolOutput = result;
				} catch (err) {
					console.error("Failed to load component data:", err);
				}
			}
		}
	};

	if (!initialized) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
				<div className="max-w-md w-full bg-gray-900 rounded-lg p-8 space-y-6">
					<div>
						<h1 className="text-2xl font-bold">MCP Dev Preview</h1>
						<p className="text-gray-400 mt-2">Initialize MCP session to preview widgets</p>
					</div>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								User ID <span className="text-red-400">*</span>
							</label>
							<input
								type="text"
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
								placeholder="user-xxx"
								className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>${organizationFormFields}
					</div>

					{error && (
						<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
							{error}
						</div>
					)}

					<button
						onClick={handleInitialize}
						disabled={loading}
						className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-3 rounded-lg font-medium transition"
					>
						{loading ? "Initializing..." : "Initialize MCP Session"}
					</button>

					<div className="text-xs text-gray-500 space-y-1">
						<p>Make sure your MCP server is running at:</p>
						<p className="font-mono">{mcpServerUrl}</p>
					</div>
				</div>
			</div>
		);
	}

	const SelectedComponent = COMPONENTS[selectedComponent].component;

	return (
		<div className="min-h-screen bg-gray-950 text-gray-100">
			<div className="border-b border-gray-800 bg-gray-900 p-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<h1 className="text-xl font-bold">Widget Preview</h1>
					<select
						value={selectedComponent}
						onChange={(e) => handleComponentChange(e.target.value as ComponentKey)}
						className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{Object.entries(COMPONENTS).map(([key, config]) => (
							<option key={key} value={key}>
								{config.name}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="p-4">
				<div className="max-w-7xl mx-auto">
					<div className="bg-white text-gray-900 rounded-lg shadow-lg">
						<SelectedComponent />
					</div>
				</div>
			</div>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<DevPreview />
	</React.StrictMode>,
);
`;
}
