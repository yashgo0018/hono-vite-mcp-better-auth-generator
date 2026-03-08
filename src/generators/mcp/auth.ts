import type { ProjectConfig } from "../../types";

export function generateMcpAuth(config: ProjectConfig): string {
	if (!config.includeMcpOAuth) {
		return `// MCP authentication utilities
export async function verifyMcpAccess(): Promise<boolean> {
	// TODO: Implement MCP access verification
	return true;
}
`;
	}

	return `import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { createAuthClient } from "better-auth/client";
${config.includeDatabase ? `import { createDb, schema } from "@${config.name}/db";
import { desc, eq } from "drizzle-orm";
import { resolveDatabaseUrl } from "../lib/db-url";` : ""}
import { getAuth } from "../auth";
import type { Bindings } from "../env";

/** Verify OAuth 2.1 access token and return userId, or null if invalid. */
export async function verifyOAuthAccessToken({
	env,
	accessToken,
	issuer,
	audience,
}: {
	env: Bindings;
	accessToken: string;
	issuer: string;
	audience: string;
}): Promise<{ userId: string } | null> {
	const auth = getAuth(env);
	const serverClient = createAuthClient({
		plugins: [oauthProviderResourceClient(auth)],
	});
	try {
		const payload = await serverClient.verifyAccessToken(accessToken, {
			verifyOptions: { issuer, audience },
		});
		const sub = payload?.sub;
		if (typeof sub !== "string") return null;
		return { userId: sub };
	} catch {
		return null;
	}
}

async function signSessionCookieValue(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
	const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return encodeURIComponent(\`\${value}.\${base64Signature}\`);
}

/** Convert an OAuth Bearer token into a Better Auth session cookie. */
export async function getSessionCookieForMcpBearer({
	env,
	accessToken,
	issuer,
	audience,
}: {
	env: Bindings;
	accessToken: string;
	issuer: string;
	audience: string;
}): Promise<string | null> {
	const verified = await verifyOAuthAccessToken({ env, accessToken, issuer, audience });
	if (!verified?.userId) return null;
${config.includeDatabase ? `
	const db = createDb(resolveDatabaseUrl(env));
	const [authSession] = await db
		.select({ token: schema.session.token })
		.from(schema.session)
		.where(eq(schema.session.userId, verified.userId))
		.orderBy(desc(schema.session.updatedAt))
		.limit(1);

	if (!authSession?.token) return null;

	const signedValue = await signSessionCookieValue(authSession.token, env.BETTER_AUTH_SECRET);
	return \`better-auth.session_token=\${signedValue}\`;
` : `
	// Without a database, fall back to empty (API calls will use Authorization header)
	return null;
`}}
`;
}
