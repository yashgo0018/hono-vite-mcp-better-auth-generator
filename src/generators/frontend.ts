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

	if (config.includeAuth) {
		createDirectory(join(webPath, "src/context"));
		createDirectory(join(webPath, "src/routes"));
		createDirectory(join(webPath, "src/routes/layouts"));
		createDirectory(join(webPath, "src/routes/auth"));
		createDirectory(join(webPath, "src/routes/dashboard"));
	}

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

		zod: "catalog:",
	};

	if (config.includeBackend) {
		deps.hono = versions.get("hono") || "^4.11.7";
	}

	if (config.includeAuth) {
		deps["better-auth"] = versions.get("better-auth") || "^1.3.12";
	}

	if (config.includeMcpOAuth) {
		deps["@better-auth/oauth-provider"] = versions.get("@better-auth/oauth-provider") || "^1.4.18";
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

		// Auth context + guard + pages
		writeFile(join(webPath, "src/context/auth-context.ts"), generateAuthContext());
		writeFile(join(webPath, "src/context/AuthContext.tsx"), generateAuthProvider());
		writeFile(join(webPath, "src/context/use-auth.ts"), generateUseAuth());
		writeFile(join(webPath, "src/routes/layouts/AuthGuard.tsx"), generateAuthGuard());
		writeFile(join(webPath, "src/lib/auth-functions.ts"), generateAuthFunctions(config));
		writeFile(join(webPath, "src/routes/auth/LoginPage.tsx"), generateLoginPage(config));
		writeFile(join(webPath, "src/routes/auth/SignupPage.tsx"), generateSignupPage(config));
		writeFile(join(webPath, "src/routes/dashboard/DashboardPage.tsx"), generateDashboardPage(config));
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
	if (config.includeAuth) {
		return `import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<App />
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
`;
	}

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
					${config.includeBackend
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

	// Auth-enabled: full router with AuthGuard
	if (config.includeAuth) {
		const imports = [
			`import { BrowserRouter, Routes, Route } from "react-router-dom";`,
			`import { AuthGuard } from "./routes/layouts/AuthGuard";`,
			`import { LoginPage } from "./routes/auth/LoginPage";`,
			`import { SignupPage } from "./routes/auth/SignupPage";`,
			`import { DashboardPage } from "./routes/dashboard/DashboardPage";`,
		];
		if (config.includeMcpOAuth) {
			imports.push(`import ConsentPage from "./pages/consent";`);
		}

		return `${imports.join("\n")}

function Home() {
	return (
${homeContent}
	);
}

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<AuthGuard />}>
					<Route path="/" element={<Home />} />
					<Route path="/auth/login" element={<LoginPage />} />
					<Route path="/auth/signup" element={<SignupPage />} />
					<Route path="/dashboard" element={<DashboardPage />} />${config.includeMcpOAuth ? `\n\t\t\t\t\t<Route path="/consent" element={<ConsentPage />} />` : ""}
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;
`;
	}

	// MCP OAuth only (no auth): just the consent route
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
			`	VITE_API_ORIGIN: z.url().default("http://localhost:8787")`,
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
			`import { organizationClient } from "better-auth/client/plugins";`,
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

export const authClient = createAuthClient({
	plugins: [${plugins.join(", ")}],
	baseURL: env.VITE_API_ORIGIN,
	fetch: (input: RequestInfo | URL, init?: RequestInit) => {
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

function generateAuthContext(): string {
	return `import type { Session } from "better-auth";
import { createContext } from "react";

export type AuthUser = {
	id: string;
	email: string;
	name: string;
	image?: string | null;
};

export type AuthContextType = {
	user: AuthUser | null;
	session: Session | null;
	isFirstLoaded: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);
`;
}

function generateAuthProvider(): string {
	return `import type { Session } from "better-auth";
import { useEffect, useState } from "react";
import { authClient } from "@/auth";
import { AuthContext, type AuthUser } from "@/context/auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [sessionData, setSessionData] = useState<{
		session: Session;
		user: AuthUser;
	} | null>(null);
	const [isFirstLoaded, setIsFirstLoaded] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const loadSession = async () => {
			const result = await authClient.getSession();
			if (!isMounted) return;
			setSessionData(result.data as { session: Session; user: AuthUser });
			setIsFirstLoaded(true);
		};

		loadSession();
		authClient.$store.listen("$sessionSignal", () => {
			loadSession();
		});

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user: sessionData?.user ?? null,
				session: sessionData?.session ?? null,
				isFirstLoaded,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
`;
}

function generateUseAuth(): string {
	return `import { useContext } from "react";
import { AuthContext } from "@/context/auth-context";

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
`;
}

function generateAuthGuard(): string {
	return `import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/use-auth";

const PROTECTED_PATHS = ["/dashboard"];
const AUTH_PATHS = ["/auth/login", "/auth/signup"];

export function AuthGuard() {
	const { user, isFirstLoaded } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();

	const isProtectedPath = PROTECTED_PATHS.some((p) => location.pathname.startsWith(p));
	const isAuthPath = AUTH_PATHS.some((p) => location.pathname.startsWith(p));

	useEffect(() => {
		if (!isFirstLoaded) return;

		if (!user && isProtectedPath) {
			localStorage.setItem("redirectAfterAuth", location.pathname + location.search);
			navigate("/auth/login", { replace: true });
			return;
		}

		if (user && isAuthPath) {
			const redirect = localStorage.getItem("redirectAfterAuth");
			if (redirect) {
				localStorage.removeItem("redirectAfterAuth");
				navigate(redirect, { replace: true });
			} else {
				navigate("/dashboard", { replace: true });
			}
		}
	}, [isFirstLoaded, user, location.pathname, location.search, navigate, isProtectedPath, isAuthPath]);

	if (!isFirstLoaded && isProtectedPath) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return <Outlet />;
}
`;
}

function generateAuthFunctions(config: ProjectConfig): string {
	const lines = [
		`import { authClient } from "@/auth";`,
		``,
		`export const signIn = (email: string, password: string) =>`,
		`\tauthClient.signIn.email({ email, password });`,
		``,
		`export const signUp = (email: string, password: string, name = "") =>`,
		`\tauthClient.signUp.email({ email, password, name });`,
		``,
		`export const signOut = () => authClient.signOut();`,
	];

	if (config.includeGoogleAuth) {
		lines.push(
			``,
			`export const signInWithGoogle = () =>`,
			`\tauthClient.signIn.social({`,
			`\t\tprovider: "google",`,
			`\t\tcallbackURL: \`\${window.location.origin}/dashboard\`,`,
			`\t\terrorCallbackURL: \`\${window.location.origin}/auth/login\`,`,
			`\t});`,
		);
	}

	return lines.join("\n") + "\n";
}

function generateLoginPage(config: ProjectConfig): string {
	const googleButton = config.includeGoogleAuth
		? `
			<button
				type="button"
				onClick={handleGoogleSignIn}
				disabled={googleLoading || loading}
				className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
			>
				{googleLoading ? (
					<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
				) : (
					<svg className="w-5 h-5" viewBox="0 0 24 24">
						<title>Google</title>
						<path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
						<path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
						<path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
						<path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
					</svg>
				)}
				{googleLoading ? "Signing in..." : "Sign in with Google"}
			</button>

			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<span className="w-full border-t border-gray-700" />
				</div>
				<div className="relative flex justify-center text-xs uppercase">
					<span className="bg-gray-900 px-2 text-gray-500">Or continue with email</span>
				</div>
			</div>`
		: "";

	const googleState = config.includeGoogleAuth
		? `\n\tconst [googleLoading, setGoogleLoading] = useState(false);`
		: "";

	const googleImport = config.includeGoogleAuth
		? `import { signIn, signInWithGoogle } from "@/lib/auth-functions";`
		: `import { signIn } from "@/lib/auth-functions";`;

	const googleHandler = config.includeGoogleAuth
		? `
	const handleGoogleSignIn = async () => {
		setGoogleLoading(true);
		setError(null);
		try {
			const result = await signInWithGoogle();
			if (result?.error) {
				setError(result.error.message ?? "Failed to sign in with Google");
				setGoogleLoading(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An unexpected error occurred");
			setGoogleLoading(false);
		}
	};`
		: "";

	const disabledAttr = config.includeGoogleAuth
		? "disabled={loading || googleLoading}"
		: "disabled={loading}";

	return `import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
${googleImport}

export function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);${googleState}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const result = await signIn(email, password);
			if (result.error) {
				setError(result.error.message ?? "Invalid email or password");
				setLoading(false);
				return;
			}
			const redirect = localStorage.getItem("redirectAfterAuth");
			if (redirect) {
				localStorage.removeItem("redirectAfterAuth");
				navigate(redirect);
			} else {
				navigate("/dashboard");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};
${googleHandler}
	return (
		<div className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center px-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-3xl font-bold">Welcome back</h1>
					<p className="mt-2 text-gray-400">Sign in to your account</p>
				</div>

				<div className="bg-gray-900 rounded-xl p-8 space-y-4">
					${googleButton}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1">
							<label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								${disabledAttr}
								placeholder="you@example.com"
								className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							/>
						</div>

						<div className="space-y-1">
							<label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								${disabledAttr}
								className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							/>
						</div>

						{error && (
							<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<button
							type="submit"
							${disabledAttr}
							className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
						>
							{loading ? "Signing in..." : "Sign In"}
						</button>
					</form>
				</div>

				<p className="text-center text-sm text-gray-400">
					Don't have an account?{" "}
					<Link to="/auth/signup" className="text-blue-400 hover:underline font-medium">
						Sign up
					</Link>
				</p>
			</div>
		</div>
	);
}
`;
}

function generateSignupPage(config: ProjectConfig): string {
	const googleButton = config.includeGoogleAuth
		? `
			<button
				type="button"
				onClick={handleGoogleSignIn}
				disabled={googleLoading || loading}
				className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
			>
				{googleLoading ? (
					<span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
				) : (
					<svg className="w-5 h-5" viewBox="0 0 24 24">
						<title>Google</title>
						<path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
						<path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
						<path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
						<path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
					</svg>
				)}
				{googleLoading ? "Signing up..." : "Sign up with Google"}
			</button>

			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<span className="w-full border-t border-gray-700" />
				</div>
				<div className="relative flex justify-center text-xs uppercase">
					<span className="bg-gray-900 px-2 text-gray-500">Or continue with email</span>
				</div>
			</div>`
		: "";

	const googleState = config.includeGoogleAuth
		? `\n\tconst [googleLoading, setGoogleLoading] = useState(false);`
		: "";

	const googleImport = config.includeGoogleAuth
		? `import { signUp, signInWithGoogle } from "@/lib/auth-functions";`
		: `import { signUp } from "@/lib/auth-functions";`;

	const googleHandler = config.includeGoogleAuth
		? `
	const handleGoogleSignIn = async () => {
		setGoogleLoading(true);
		setError(null);
		try {
			const result = await signInWithGoogle();
			if (result?.error) {
				setError(result.error.message ?? "Failed to sign up with Google");
				setGoogleLoading(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An unexpected error occurred");
			setGoogleLoading(false);
		}
	};`
		: "";

	const disabledAttr = config.includeGoogleAuth
		? "disabled={loading || googleLoading}"
		: "disabled={loading}";

	return `import { useState } from "react";
import { Link } from "react-router-dom";
${googleImport}

export function SignupPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);${googleState}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}

		setLoading(true);
		try {
			const result = await signUp(email, password);
			if (result.error) {
				setError(result.error.message ?? "Failed to create account");
				setLoading(false);
				return;
			}
			setSuccess("Account created! You can now sign in.");
			setEmail("");
			setPassword("");
			setConfirmPassword("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};
${googleHandler}
	return (
		<div className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center px-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-3xl font-bold">Create an account</h1>
					<p className="mt-2 text-gray-400">Get started with ${config.name}</p>
				</div>

				<div className="bg-gray-900 rounded-xl p-8 space-y-4">
					${googleButton}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1">
							<label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								${disabledAttr}
								placeholder="you@example.com"
								className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							/>
						</div>

						<div className="space-y-1">
							<label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								${disabledAttr}
								placeholder="At least 6 characters"
								className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							/>
						</div>

						<div className="space-y-1">
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">Confirm Password</label>
							<input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								${disabledAttr}
								className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
							/>
						</div>

						{error && (
							<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						{success && (
							<div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
								{success}
							</div>
						)}

						<button
							type="submit"
							${disabledAttr}
							className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
						>
							{loading ? "Creating account..." : "Sign Up"}
						</button>
					</form>
				</div>

				<p className="text-center text-sm text-gray-400">
					Already have an account?{" "}
					<Link to="/auth/login" className="text-blue-400 hover:underline font-medium">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
`;
}

function generateDashboardPage(config: ProjectConfig): string {
	return `import { useAuth } from "@/context/use-auth";
import { signOut } from "@/lib/auth-functions";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const handleSignOut = async () => {
		await signOut();
		navigate("/");
	};

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
				<h1 className="text-xl font-semibold">${config.name}</h1>
				<div className="flex items-center gap-4">
					<span className="text-sm text-gray-400">{user?.email}</span>
					<button
						type="button"
						onClick={handleSignOut}
						className="text-sm px-3 py-1.5 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
					>
						Sign out
					</button>
				</div>
			</header>

			<main className="p-6">
				<h2 className="text-2xl font-bold">Dashboard</h2>
				<p className="mt-2 text-gray-400">Welcome, {user?.name || user?.email}!</p>
			</main>
		</div>
	);
}
`;
}
