import type { ProjectConfig } from "../../types";

export function generateAuthContext(): string {
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

export function generateAuthProvider(): string {
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

export function generateUseAuth(): string {
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

export function generateAuthGuard(): string {
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

export function generateAuthFunctions(config: ProjectConfig): string {
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

export function generateLoginPage(config: ProjectConfig): string {
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

export function generateSignupPage(config: ProjectConfig): string {
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

export function generateDashboardPage(config: ProjectConfig): string {
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

export function generateNavbar(config: ProjectConfig): string {
  return `import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/use-auth";
import { signOut } from "@/lib/auth-functions";

export function Navbar() {
	const { user } = useAuth();
	const location = useLocation();
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Hide on dashboard — it has its own header
	if (location.pathname.startsWith("/dashboard")) return null;

	const handleSignOut = async () => {
		await signOut();
		window.location.href = "/";
	};

	return (
		<nav
			className={\`fixed top-0 left-0 right-0 z-50 transition-all duration-300 \${
				scrolled
					? "bg-gray-950/80 backdrop-blur-lg border-b border-gray-800"
					: "bg-transparent"
			}\`}
		>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					<Link to="/" className="font-semibold text-lg text-gray-50">
						${config.name}
					</Link>

					<div className="flex items-center gap-4">
						{user ? (
							<>
								<Link
									to="/dashboard"
									className="text-sm text-gray-300 hover:text-gray-50 transition-colors"
								>
									Dashboard
								</Link>
								<button
									type="button"
									onClick={handleSignOut}
									className="text-sm px-3 py-1.5 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-gray-50 transition"
								>
									Sign out
								</button>
							</>
						) : (
							<>
								<Link
									to="/auth/login"
									className="text-sm text-gray-300 hover:text-gray-50 transition-colors"
								>
									Sign in
								</Link>
								<Link
									to="/auth/signup"
									className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
								>
									Get started
								</Link>
							</>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
`;
}
