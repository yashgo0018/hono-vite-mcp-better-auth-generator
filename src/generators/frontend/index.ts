import { join } from "path";
import type { ProjectConfig } from "../../types";
import { createDirectory, writeFile } from "../../utils/file-utils";
import { frontendGitignore } from "../../gitignore";
import { generateViteConfig, generateIndexHtml, generateIndexCss } from "./config-files";
import { generateMainTsx, generateAppTsx } from "./app";
import {
  generateFrontendEnv,
  generateFrontendEnvExample,
  generateApiClient,
  generateAuthClient,
} from "./env";
import { generateOAuthConsentPage } from "./consent";
import {
  generateAuthContext,
  generateAuthProvider,
  generateUseAuth,
  generateAuthGuard,
  generateAuthFunctions,
  generateLoginPage,
  generateSignupPage,
  generateDashboardPage,
  generateNavbar,
} from "./auth-pages";

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

    // src/components/Navbar.tsx
    writeFile(join(webPath, "src/components/Navbar.tsx"), generateNavbar(config));

    // Auth context + guard + pages
    writeFile(join(webPath, "src/context/auth-context.ts"), generateAuthContext());
    writeFile(join(webPath, "src/context/AuthContext.tsx"), generateAuthProvider());
    writeFile(join(webPath, "src/context/use-auth.ts"), generateUseAuth());
    writeFile(join(webPath, "src/routes/layouts/AuthGuard.tsx"), generateAuthGuard());
    writeFile(join(webPath, "src/lib/auth-functions.ts"), generateAuthFunctions(config));
    writeFile(join(webPath, "src/routes/auth/LoginPage.tsx"), generateLoginPage(config));
    writeFile(join(webPath, "src/routes/auth/SignupPage.tsx"), generateSignupPage(config));
    writeFile(
      join(webPath, "src/routes/dashboard/DashboardPage.tsx"),
      generateDashboardPage(config),
    );
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

  writeFile(join(webPath, ".gitignore"), frontendGitignore);

  // OAuth consent page
  if (config.includeMcpOAuth) {
    createDirectory(join(webPath, "src/pages"));

    const consentPageTsx = generateOAuthConsentPage(config);
    writeFile(join(webPath, "src/pages/consent.tsx"), consentPageTsx);
  }

  // public/favicon.ico (placeholder)
  writeFile(join(webPath, "public/favicon.ico"), "");
}
