import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// Ensure the directory exists on startup so users can drop files in later
if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
}

let cachedSkills: string = "";

/**
 * Loads all skills from the /skills directory into memory.
 */
export async function loadSkills(): Promise<void> {
    try {
        const files = await fs.readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith(".md"));

        if (mdFiles.length === 0) {
            cachedSkills = "";
            return;
        }

        let combinedSkills = "\n\nAVAILABLE SKILLS & PLUGINS:\n";
        
        for (const file of mdFiles) {
            const content = await fs.readFile(path.join(SKILLS_DIR, file), "utf-8");
            combinedSkills += `\n--- Skill: ${file} ---\n${content}\n`;
        }

        cachedSkills = combinedSkills;
        console.log(`🧠 Skills loaded from /skills (${mdFiles.length} files)`);
    } catch (e) {
        console.error("❌ Failed to load skills:", e);
        cachedSkills = "";
    }
}

/**
 * Returns the cached skills context.
 */
export function getSkillsContext(): string {
    return cachedSkills;
}
