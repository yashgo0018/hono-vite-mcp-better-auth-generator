import type { ProjectConfig } from "../types";

const FALLBACK_VERSIONS: Record<string, string> = {
	"@cloudflare/workers-types": "^4.20260131.0",
	typescript: "^5.9.3",
	zod: "^4.3.6",
	"@biomejs/biome": "^1.9.4",
	hono: "^4.11.7",
	"@hono/zod-validator": "^0.7.6",
	wrangler: "^3.107.0",
	react: "^19.2.4",
	"react-dom": "^19.2.4",
	"@types/react": "^19.2.10",
	"@types/react-dom": "^19.2.10",
	vite: "^7.3.1",
	"@vitejs/plugin-react": "^6.0.1",
	"@tailwindcss/vite": "^4.1.18",
	"react-router-dom": "^7.13.0",
	"better-auth": "^1.3.12",
	"drizzle-orm": "^0.45.1",
	"drizzle-kit": "^0.31.8",
	postgres: "^3.4.7",
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
	]);

	if (config.packageManager === "bun") {
		packages.add("bun"); // For packageManager field
	}

	if (config.includeFrontend) {
		packages.add("@tailwindcss/vite");
		packages.add("@types/react");
		packages.add("@types/react-dom");
		packages.add("react");
		packages.add("react-dom");
		packages.add("vite");
		packages.add("@vitejs/plugin-react");
		packages.add("react-router-dom");
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
