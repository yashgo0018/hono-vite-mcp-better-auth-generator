import type { ProjectConfig } from "../../types";

export function generateMcpResources(config: ProjectConfig): string {
	const widgetResources = config.includeMcpWebComponents
		? `
	"ui://widget/example.html": {
		name: "Example Widget",
		mimeType: "text/html+skybridge",
		async getContent() {
			// TODO: Import widget HTML from web-components build
			return \`<!DOCTYPE html>
<html>
	<head>
		<title>Example Widget</title>
	</head>
	<body>
		<div id="root"></div>
		<script>
			// Widget implementation
			document.getElementById("root").innerHTML = "<h1>Example Widget</h1>";
		</script>
	</body>
</html>\`;
		},
	},
`
		: "";

	return `export const resources = {
	"doc://app/getting-started": {
		name: "Getting Started Guide",
		mimeType: "text/markdown",
		async getContent() {
			return \`# Getting Started with ${config.name}

This is your MCP-enabled application. Use the available tools to interact with the system.

## Available Tools

- \\\`get_user\\\` - Get current user information
- \\\`list_records\\\` - List records
- \\\`create_record\\\` - Create a new record
${
	config.includeOrganizations
		? `- \\\`list_organizations\\\` - List organizations
- \\\`switch_organization\\\` - Switch default organization`
		: ""
}

## Resources

- \\\`doc://app/getting-started\\\` - This guide
${config.includeMcpWebComponents ? "- \`ui://widget/example.html\` - Example interactive widget" : ""}
\`;
		},
	},
${widgetResources}
};

export type ResourceUri = keyof typeof resources;
`;
}
