import { join } from "path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateUtilsPackage(projectPath: string, config: ProjectConfig) {
	const utilsPath = join(projectPath, "packages/utils");
	createDirectory(utilsPath);
	createDirectory(join(utilsPath, "src"));

	// package.json
	const packageJson = {
		name: `@${config.name}/utils`,
		type: "module",
		main: "src/index.ts",
		exports: {
			".": "./src/index.ts",
		},
	};

	writeFile(join(utilsPath, "package.json"), JSON.stringify(packageJson, null, 2));

	// tsconfig.json
	const tsConfig = {
		extends: "../../tsconfig.base.json",
		include: ["src"],
	};

	writeFile(join(utilsPath, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

	// src/index.ts
	const indexTs = `export const ensureTrailingSlash = (value: string) =>
	value.endsWith("/") ? value : \`\${value}/\`;

export const invariant = (condition: unknown, message: string): asserts condition => {
	if (!condition) {
		throw new Error(message);
	}
};

export const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
};

export const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
`;

	writeFile(join(utilsPath, "src/index.ts"), indexTs);
}
