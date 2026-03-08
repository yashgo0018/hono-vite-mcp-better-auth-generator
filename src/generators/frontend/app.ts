import type { ProjectConfig } from "../../types";

export function generateMainTsx(config: ProjectConfig): string {
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

export function generateAppTsx(config: ProjectConfig): string {
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

	// Auth-enabled: full router with AuthGuard + Navbar
	if (config.includeAuth) {
		const imports = [
			`import { BrowserRouter, Routes, Route } from "react-router-dom";`,
			`import { AuthGuard } from "./routes/layouts/AuthGuard";`,
			`import { Navbar } from "./components/Navbar";`,
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
			<Navbar />
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
