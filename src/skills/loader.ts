import fs from "fs/promises";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// Ensure the directory exists on startup so users can drop files in later
if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
}

interface Skill {
    name: string;
    content: string;
}

let skillMap: Map<string, string> = new Map();

/**
 * Loads all skills from the /skills directory into memory.
 */
export async function loadSkills(): Promise<void> {
    try {
        const files = await fs.readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith(".md"));

        if (mdFiles.length === 0) {
            skillMap.clear();
            return;
        }

        const newMap = new Map<string, string>();
        for (const file of mdFiles) {
            const content = await fs.readFile(path.join(SKILLS_DIR, file), "utf-8");
            newMap.set(file, content);
        }

        skillMap = newMap;
        console.log(`🧠 Skills indexed in-memory (${skillMap.size} files)`);
    } catch (e) {
        console.error("❌ Failed to load skills:", e);
        skillMap.clear();
    }
}

/**
 * Returns a subset of skills relevant to the user's query.
 * (RAG-lite: Keyword based filtering to save context tokens)
 */
export function getSkillsContext(query: string): string {
    if (skillMap.size === 0) return "";

    // If query is very short or generic status, return nothing or a tiny summary
    if (!query || query.length < 3) return "";

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Always include 'learn' if user asks about skills or installing
    if (query.toLowerCase().includes("skill") || query.toLowerCase().includes("install") || query.toLowerCase().includes("/learn")) {
        keywords.push("learn.md");
    }

    const matchedSkills: string[] = [];
    const maxSkills = 3;

    for (const [filename, content] of skillMap.entries()) {
        const lowerName = filename.toLowerCase();
        const lowerContent = content.toLowerCase();

        // Direct filename match is high priority
        if (keywords.some(k => lowerName.includes(k))) {
            matchedSkills.push(`\n--- Skill: ${filename} ---\n${content}\n`);
            continue;
        }

        // Content match is fallback
        if (keywords.some(k => lowerContent.includes(k))) {
            matchedSkills.push(`\n--- Skill: ${filename} ---\n${content}\n`);
        }

        if (matchedSkills.length >= maxSkills) break;
    }

    if (matchedSkills.length === 0) {
        // Provide a small list of available skill names if no direct matches, 
        // helps the LLM know what it COULD ask for.
        const allNames = Array.from(skillMap.keys()).join(", ");
        return `\n\nAVAILABLE SKILL CATALOG (Call by name to use): ${allNames}\n`;
    }

    return `\n\nRELEVANT SKILLS DISK-LOADED:\n${matchedSkills.join("\n")}\n`;
}

/**
 * Returns all skill names for status checks.
 */
export function getAllSkillNames(): string[] {
    return Array.from(skillMap.keys());
}
