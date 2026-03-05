#!/usr/bin/env bun

import { intro, outro, text, select, confirm, spinner, note } from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateProject } from "./generators/project";

interface ProjectConfig {
	name: string;
	description: string;
	author: string;
	packageManager: "bun" | "npm" | "pnpm" | "yarn";
	includeBackend: boolean;
	includeFrontend: boolean;
	includeDatabase: boolean;
	includeAuth: boolean;
	includeGithubActions: boolean;
}

async function main() {
	console.clear();

	intro(chalk.bgCyan(chalk.black(" Project Builder ")));

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

	const projectPath = join(process.cwd(), projectName);
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

	const includeDatabase = await confirm({
		message: "Include database package (Drizzle ORM)?",
		initialValue: true,
	});

	if (typeof includeDatabase === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const includeAuth = await confirm({
		message: "Include Better Auth integration?",
		initialValue: true,
	});

	if (typeof includeAuth === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
	}

	const includeGithubActions = await confirm({
		message: "Include GitHub Actions workflows?",
		initialValue: true,
	});

	if (typeof includeGithubActions === "symbol") {
		outro(chalk.red("Project creation cancelled"));
		process.exit(0);
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
		includeGithubActions,
	};

	const s = spinner();
	s.start("Generating project structure...");

	try {
		await generateProject(projectPath, config);
		s.stop("Project created successfully!");

		note(
			`
cd ${projectName}
${config.packageManager} install
${config.packageManager === "bun" ? "bun run" : config.packageManager === "npm" ? "npm run" : config.packageManager} dev
      `.trim(),
			"Next steps",
		);

		outro(chalk.green("Happy coding! 🚀"));
	} catch (error) {
		s.stop("Failed to create project");
		outro(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
		process.exit(1);
	}
}

main().catch(console.error);
