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
  wrangler: "^4.71.0",
  "better-auth": "^1.3.12",
  "@better-auth/drizzle-adapter": "^1.3.12",

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
  "@vitejs/plugin-react": "^5.1.4",
  "react-router-dom": "^7.13.0",

  // TailwindCSS
  "@tailwindcss/vite": "^4.1.18",
  tailwindcss: "^4.1.18",

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

  // MCP
  "@hono/mcp": "^0.2.3",
  "@modelcontextprotocol/sdk": "^1.26.0",
  "@better-auth/oauth-provider": "^1.4.18",

  // Web Components
  "@tanstack/react-table": "^8.21.3",
  jose: "^6.1.0",
  "tw-animate-css": "^1.4.0",

  // Package Manager
  bun: "1.2.18", // No ^ prefix for packageManager field
};

class NpmVersionCache {
  cache = new Map<string, string>();

  fetchLatestVersions(packages: string[]): Map<string, string> {
    for (const pkg of packages) {
      this.cache.set(pkg, FALLBACK_VERSIONS[pkg] ?? "latest");
    }
    return this.cache;
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
    if (config.includeDatabase) {
      packages.add("@better-auth/drizzle-adapter");
    }
  }

  if (config.includeMcp) {
    packages.add("@hono/mcp");
    packages.add("@modelcontextprotocol/sdk");

    if (config.includeMcpOAuth) {
      packages.add("@better-auth/oauth-provider");
    }
  }

  if (config.includeMcpWebComponents) {
    packages.add("@tanstack/react-table");
    packages.add("jose");
    packages.add("tw-animate-css");
  }

  return Array.from(packages);
}
