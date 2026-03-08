import fs from "fs/promises";
import path from "path";
import { mkdirSync } from "fs";

const MEMORY_DIR = path.join(process.cwd(), "data", "memory");

// Ensure memory directory exists
try {
    mkdirSync(MEMORY_DIR, { recursive: true });
} catch (e) {
    // Ignore if exists
}

/**
 * Markdown-based Persistent Memory
 * Handles human-readable preferences and facts stored as .md files.
 */
export const markdownMemory = {
    /**
     * Reads all .md files from the memory directory and returns a concatenated string.
     */
    async loadAll(): Promise<string> {
        try {
            const files = await fs.readdir(MEMORY_DIR);
            const mdFiles = files.filter(f => f.endsWith(".md"));
            
            let combined = "";
            for (const file of mdFiles) {
                const content = await fs.readFile(path.join(MEMORY_DIR, file), "utf-8");
                combined += `\n--- From ${file} ---\n${content}\n`;
            }
            return combined.trim();
        } catch (e) {
            console.error("Markdown memory load error:", e);
            return "";
        }
    },

    /**
     * Saves a preference or fact to a specific markdown file.
     * Use this for human-editable state.
     */
    async save(filename: string, content: string): Promise<void> {
        try {
            const filePath = path.join(MEMORY_DIR, filename.endsWith(".md") ? filename : `${filename}.md`);
            await fs.writeFile(filePath, content, "utf-8");
            console.log(`📝 Markdown memory updated: ${filename}`);
        } catch (e) {
            console.error("Markdown memory save error:", e);
        }
    }
};
