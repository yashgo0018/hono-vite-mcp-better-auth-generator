import type { ProjectConfig } from "../../types";

export function generateOAuthConsentPage(config: ProjectConfig): string {
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
