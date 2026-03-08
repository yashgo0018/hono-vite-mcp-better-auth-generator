#!/usr/bin/env bun

import { intro, outro, text, select, confirm, spinner, note } from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join, resolve, relative } from "path";
import { generateProject } from "./generators/project";
import { collectRequiredPackages, versionCache } from "./utils/npm-registry";

interface ProjectConfig {
	name: string;
	description: string;
	author: string;
	packageManager: "bun" | "npm" | "pnpm" | "yarn";
	includeBackend: boolean;
	includeFrontend: boolean;
	includeDatabase: boolean;
	includeAuth: boolean;
	includeKV: boolean;
	includeR2: boolean;
	includeObservability: boolean;
	includeGithubActions: boolean;

	// Requires includeBackend && includeDatabase && includeAuth
	includeOrganizations: boolean;

	// MCP sub-options
	includeMcp: boolean;
	includeMcpOAuth: boolean;
	includeMcpWebComponents: boolean;
}

async function main() {
	console.clear();

	intro(chalk.bgCyan(chalk.black(" Project Builder ")));

	const parentDir = await text({
		message: "Where should the project be created?",
		placeholder: process.cwd(),
		initialValue: process.cwd(),
		validate: (value) => {
			if (!value) return "Parent directory is required";
			return;
		},
	});

	if (typeof parentDir === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	// Resolve path (handles relative paths, tilde expansion)
	const resolvedParentDir = resolve(parentDir);

	// Validate parent directory exists
	if (!existsSync(resolvedParentDir)) {
		const shouldCreate = await confirm({
			message: `Directory ${resolvedParentDir} doesn't exist. Create it?`,
			initialValue: true,
		});

		if (typeof shouldCreate === "symbol" || !shouldCreate) {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		try {
			mkdirSync(resolvedParentDir, { recursive: true });
		} catch (error) {
			outro(
				chalk.red(
					`Failed to create directory: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
			process.exit(1);
		}
	}

	// Validate write permissions
	try {
		const testFile = join(resolvedParentDir, `.test-${Date.now()}`);
		writeFileSync(testFile, "");
		unlinkSync(testFile);
	} catch (error) {
		outro(chalk.red(`No write permissions for ${resolvedParentDir}`));
		process.exit(1);
	}

	const projectName = await text({
		message: "What is your project name?",
		placeholder: "my-awesome-project",
		validate: (value) => {
			if (!value) return "Project name is required";
			if (!/^[a-z0-9-]+$/.test(value))
				return "Project name must be lowercase alphanumeric with dashes";
			return;
		},
	});

	if (typeof projectName === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const projectPath = join(resolvedParentDir, projectName);
	if (existsSync(projectPath)) {
		outro(chalk.red(`Directory ${projectName} already exists!`));
		process.exit(1);
	}

	const description = await text({
		message: "Project description?",
		placeholder: "An awesome full-stack application",
		initialValue: "",
	});

	if (typeof description === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const author = await text({
		message: "Author name?",
		placeholder: "Your Name",
		initialValue: "",
	});

	if (typeof author === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const packageManager = await select({
		message: "Which package manager do you want to use?",
		options: [
			{ value: "bun", label: "Bun (recommended)", hint: "Fast all-in-one toolkit" },
			{ value: "npm", label: "npm", hint: "Node Package Manager" },
			{ value: "pnpm", label: "pnpm", hint: "Fast, disk space efficient" },
			{ value: "yarn", label: "Yarn", hint: "Classic package manager" },
		],
		initialValue: "bun",
	});

	if (typeof packageManager === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const includeBackend = await confirm({
		message: "Include backend (Cloudflare Workers + Hono)?",
		initialValue: true,
	});

	if (typeof includeBackend === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const includeFrontend = await confirm({
		message: "Include frontend (Vite + React)?",
		initialValue: true,
	});

	if (typeof includeFrontend === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	let includeDatabase = false;
	let includeAuth = false;
	let includeOrganizations = false;
	let includeKV = false;
	let includeR2 = false;
	let includeObservability = false;

	if (includeBackend) {
		const dbResponse = await confirm({
			message: "Include database package (Drizzle ORM + PostgreSQL)?",
			initialValue: true,
		});

		if (typeof dbResponse === "symbol") {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		includeDatabase = dbResponse;

		if (includeDatabase) {
			const authResponse = await confirm({
				message: "Include Better Auth integration?",
				initialValue: true,
			});

			if (typeof authResponse === "symbol") {
				outro(chalk.red("Project creation cancelled"));
				process.exit(0);
			}

			includeAuth = authResponse;

			if (includeAuth) {
				const orgResponse = await confirm({
					message: "Include organization support?",
					initialValue: true,
				});

				if (typeof orgResponse === "symbol") {
					outro(chalk.red("Project creation cancelled"));
					process.exit(0);
				}

				includeOrganizations = orgResponse;
			}
		}

		const kvResponse = await confirm({
			message: "Include Cloudflare KV namespace?",
			initialValue: false,
		});

		if (typeof kvResponse === "symbol") {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		includeKV = kvResponse;

		const r2Response = await confirm({
			message: "Include Cloudflare R2 bucket (object storage)?",
			initialValue: false,
		});

		if (typeof r2Response === "symbol") {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		includeR2 = r2Response;

		const observabilityResponse = await confirm({
			message: "Enable observability (logs, analytics) in Cloudflare?",
			initialValue: true,
		});

		if (typeof observabilityResponse === "symbol") {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		includeObservability = observabilityResponse;
	}

	const includeGithubActions = await confirm({
		message: "Include GitHub Actions workflows?",
		initialValue: true,
	});

	if (typeof includeGithubActions === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	let includeMcp = false;
	let includeMcpOAuth = false;
	let includeMcpWebComponents = false;

	if (includeBackend) {
		const mcpResponse = await confirm({
			message: "Include MCP (Model Context Protocol) server?",
			initialValue: false,
		});

		if (typeof mcpResponse === "symbol") {
			outro(chalk.red("Project creation cancelled"));
			process.exit(0);
		}

		includeMcp = mcpResponse;
	}

	if (includeMcp) {
		if (includeAuth) {
			const mcpOAuthResponse = await confirm({
				message: "Use OAuth for MCP authentication?",
				initialValue: true,
			});

			if (typeof mcpOAuthResponse === "symbol") {
				outro(chalk.red("Project creation cancelled"));
				process.exit(0);
			}

			includeMcpOAuth = mcpOAuthResponse;
		}

		if (includeFrontend) {
			const webComponentsResponse = await confirm({
				message: "Include ChatGPT app SDK support (web components)?",
				initialValue: true,
			});

			if (typeof webComponentsResponse === "symbol") {
				outro(chalk.red("Project creation cancelled"));
				process.exit(0);
			}

			includeMcpWebComponents = webComponentsResponse;
		}
	}

	const config: ProjectConfig = {
		name: projectName,
		description: typeof description === "string" ? description : "",
		author: typeof author === "string" ? author : "",
		packageManager: packageManager as "bun" | "npm" | "pnpm" | "yarn",
		includeBackend,
		includeFrontend,
		includeDatabase,
		includeAuth,
		includeKV,
		includeR2,
		includeObservability,
		includeGithubActions,
		includeOrganizations,
		includeMcp,
		includeMcpOAuth,
		includeMcpWebComponents,
	};

	const s = spinner();
	s.start("Fetching latest package versions...");

	try {
		// Pre-fetch all versions
		const allPackages = collectRequiredPackages(config);
		await versionCache.fetchLatestVersions(allPackages);

		// Show any packages using fallback versions
		const failedPackages = allPackages.filter((pkg) => !versionCache.cache.has(pkg));

		if (failedPackages.length > 0) {
			const warningMsg = `Using fallback versions for: ${failedPackages.join(", ")}`;
			s.message(warningMsg);
		}

		s.message("Generating project structure...");
		await generateProject(projectPath, config);

		s.stop("Project created successfully!");

		// Show correct path for cd command
		const relativePath = relative(process.cwd(), projectPath);
		const runCmd =
			config.packageManager === "bun" ? "bun run"
			: config.packageManager === "npm" ? "npm run"
			: config.packageManager === "pnpm" ? "pnpm run"
			: "yarn run";
		const nextSteps = [`cd ${relativePath}`, `${config.packageManager} install`];

		if (config.includeAuth && config.includeDatabase) {
			nextSteps.push(`${runCmd} auth:generate          # Generate Better Auth schema`);
		}

		if (config.includeKV || config.includeR2) {
			const resources = [
				config.includeKV && "KV namespaces",
				config.includeR2 && "R2 buckets",
			]
				.filter(Boolean)
				.join(" & ");
			nextSteps.push(`./scripts/install-cloudflare.sh  # Setup ${resources}`);
		}

		if (config.includeGithubActions) {
			nextSteps.push(`./scripts/setup-github-env.sh    # Configure GitHub secrets/variables`);
		}

		nextSteps.push(`${runCmd} dev`);

		note(nextSteps.join("\n"), "Next steps");

		if (config.includeKV || config.includeR2 || config.includeGithubActions) {
			const automationNotes: string[] = [];
			if (config.includeKV || config.includeR2) {
				const resources = [
					config.includeKV && "KV namespaces",
					config.includeR2 && "R2 buckets",
				]
					.filter(Boolean)
					.join(" and ");
				automationNotes.push(`- Run install-cloudflare.sh to create ${resources}`);
			}
			if (config.includeGithubActions) {
				automationNotes.push("- Run setup-github-env.sh to configure GitHub environments");
			}
			note(automationNotes.join("\n"), "🤖 Automation Scripts");
		}

		outro(chalk.green("Happy coding! 🚀"));
	} catch (error) {
		s.stop("Failed to create project");
		outro(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
		process.exit(1);
	}
}

main().catch(console.error);
