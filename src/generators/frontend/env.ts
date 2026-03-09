import type { ProjectConfig } from "../../types";

export function generateFrontendEnv(config: ProjectConfig): string {
  const fields: string[] = [];

  if (config.includeBackend) {
    fields.push(`	VITE_API_ORIGIN: z.url().default("http://localhost:8787")`);
  }

  return `import { z } from "zod";

const envSchema = z.object({
${fields.join(",\n")}
});

export const env = envSchema.parse(import.meta.env);
`;
}

export function generateFrontendEnvExample(config: ProjectConfig): string {
  const vars: string[] = [];

  if (config.includeBackend) {
    vars.push(`VITE_API_ORIGIN=http://localhost:8787`);
  }

  return `${vars.join("\n")}\n`;
}

export function generateApiClient(config: ProjectConfig): string {
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

export function generateAuthClient(config: ProjectConfig): string {
  const plugins = [];
  const pluginImports = [];

  if (config.includeOrganizations) {
    pluginImports.push(`import { organizationClient } from "better-auth/client/plugins";`);
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
