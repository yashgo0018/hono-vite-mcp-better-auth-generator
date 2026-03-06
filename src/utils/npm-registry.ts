import type { ProjectConfig } from "../types";

const FALLBACK_VERSIONS: Record<string, string> = {
	// Core
	"@cloudflare/workers-types": "^4.20260131.0",
	typescript: "^5.9.3",
	zod: "^4.3.6",
	"@biomejs/biome": "^2.3.13",
	"bun-types": "^1.3.8",
	"dotenv-cli": "^11.0.0",

	// Backend
	hono: "^4.11.7",
	"@hono/zod-validator": "^0.7.6",
	wrangler: "^3.107.0",
	"better-auth": "^1.3.12",

	// Database
	"drizzle-orm": "^0.45.1",
	"drizzle-kit": "^0.31.8",
	postgres: "^3.4.7",

	// Frontend Core
	react: "^19.2.4",
	"react-dom": "^19.2.4",
	"@types/react": "^19.2.10",
	"@types/react-dom": "^19.2.3",
	vite: "^7.3.1",
	"@vitejs/plugin-react": "^6.0.1",
	"react-router-dom": "^7.13.0",

	// TailwindCSS
	"@tailwindcss/vite": "^4.1.18",
	tailwindcss: "^4.1.18",
	autoprefixer: "^10.4.24",
	postcss: "^8.5.6",

	// Icons & Charts
	"lucide-react": "^0.563.0",
	recharts: "^3.7.0",

	// Popular Libraries (Batteries-Included)
	"@tanstack/react-query": "^5.90.20",
	"react-hook-form": "^7.71.1",
	motion: "^12.31.0",
	sonner: "^2.0.7",
	"date-fns": "^4.1.0",
	"react-day-picker": "^9.13.0",
	clsx: "^2.1.1",
	"tailwind-merge": "^3.4.0",
	"class-variance-authority": "^0.7.1",
	cmdk: "^1.1.1",

	// shadcn/ui
	"@radix-ui/react-slot": "^1.2.4",

	// Package Manager
	bun: "1.2.18", // No ^ prefix for packageManager field
};

class NpmVersionCache {
	cache = new Map<string, string>();
	private fetching = new Set<string>();

	async getLatestVersion(packageName: string): Promise<string> {
		// Check cache
		if (this.cache.has(packageName)) {
			return this.cache.get(packageName)!;
		}

		// Prevent duplicate fetches
		if (this.fetching.has(packageName)) {
			// Wait for the ongoing fetch
			while (this.fetching.has(packageName)) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			return this.cache.get(packageName) || this.getFallbackVersion(packageName);
		}

		this.fetching.add(packageName);

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = (await response.json()) as { version: string };

			// For bun package manager, don't add ^ prefix
			const version = packageName === "bun" ? data.version : `^${data.version}`;

			this.cache.set(packageName, version);
			return version;
		} catch (error) {
			// Fallback to hardcoded version
			return this.getFallbackVersion(packageName);
		} finally {
			this.fetching.delete(packageName);
		}
	}

	async fetchLatestVersions(packages: string[]): Promise<Map<string, string>> {
		// Parallel fetch with Promise.allSettled
		const results = await Promise.allSettled(packages.map((pkg) => this.getLatestVersion(pkg)));

		// Build map with fulfilled results
		const versionMap = new Map<string, string>();
		packages.forEach((pkg, index) => {
			const result = results[index];
			if (result && result.status === "fulfilled") {
				versionMap.set(pkg, result.value);
			} else {
				// Use fallback on rejection
				versionMap.set(pkg, this.getFallbackVersion(pkg));
			}
		});

		return versionMap;
	}

	private getFallbackVersion(packageName: string): string {
		const fallback = FALLBACK_VERSIONS[packageName];
		if (fallback) {
			this.cache.set(packageName, fallback);
			return fallback;
		}
		// Default fallback
		const defaultVersion = "latest";
		this.cache.set(packageName, defaultVersion);
		return defaultVersion;
	}
}

export const versionCache = new NpmVersionCache();

export function collectRequiredPackages(config: ProjectConfig): string[] {
	const packages = new Set<string>([
		// Always needed
		"@cloudflare/workers-types",
		"typescript",
		"zod",
		"@biomejs/biome",
		"dotenv-cli",
	]);

	if (config.packageManager === "bun") {
		packages.add("bun");
		packages.add("bun-types");
	}

	if (config.includeFrontend) {
		// Core Frontend
		packages.add("@tailwindcss/vite");
		packages.add("tailwindcss");
		packages.add("@types/react");
		packages.add("@types/react-dom");
		packages.add("react");
		packages.add("react-dom");
		packages.add("vite");
		packages.add("@vitejs/plugin-react");
		packages.add("react-router-dom");
		packages.add("autoprefixer");
		packages.add("postcss");

		// Icons & Charts
		packages.add("lucide-react");
		packages.add("recharts");

		// Popular Libraries (Batteries-Included)
		packages.add("@tanstack/react-query");
		packages.add("react-hook-form");
		packages.add("motion");
		packages.add("sonner");
		packages.add("date-fns");
		packages.add("react-day-picker");
		packages.add("clsx");
		packages.add("tailwind-merge");
		packages.add("class-variance-authority");
		packages.add("cmdk");
		packages.add("@radix-ui/react-slot");
	}

	if (config.includeBackend) {
		packages.add("hono");
		packages.add("@hono/zod-validator");
		packages.add("wrangler");
	}

	if (config.includeDatabase) {
		packages.add("drizzle-orm");
		packages.add("drizzle-kit");
		packages.add("postgres");
	}

	if (config.includeAuth) {
		packages.add("better-auth");
	}

	return Array.from(packages);
}
