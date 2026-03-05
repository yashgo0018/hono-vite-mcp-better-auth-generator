import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export function createDirectory(path: string) {
	mkdirSync(path, { recursive: true });
}

export function writeFile(path: string, content: string) {
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true });
	writeFileSync(path, content, "utf-8");
}

export function replaceTemplate(template: string, data: Record<string, string>): string {
	let result = template;
	for (const [key, value] of Object.entries(data)) {
		result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
	}
	return result;
}
