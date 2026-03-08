import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// Ensure the directory exists on startup so users can drop files in later
if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
}

/**
 * Reads all Markdown files in the /skills directory and concatenates them 
 * into a single context string to be injected into the system prompt.
 */
export async function getSkillsContext(): Promise<string> {
    try {
        const files = await fs.readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith(".md"));

        if (mdFiles.length === 0) {
            return "";
        }

        let combinedSkills = "AVAILABLE SKILLS & PLUGINS:\n";
        
        for (const file of mdFiles) {
            const content = await fs.readFile(path.join(SKILLS_DIR, file), "utf-8");
            combinedSkills += `\n--- Skill: ${file} ---\n${content}\n`;
        }

        return combinedSkills;
    } catch (e) {
        console.error("Failed to load skills:", e);
        return "";
    }
}
