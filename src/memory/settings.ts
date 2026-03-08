import { db } from "./database.js";

/**
 * Valid thinking levels.
 */
export type ThinkingLevel = "off" | "low" | "medium" | "high";

/**
 * Get the current thinking level for a user.
 * Defaults to "off" if not set.
 */
export function getThinkingLevel(userId: number): ThinkingLevel {
    const row = db.prepare("SELECT thinking_level FROM user_settings WHERE user_id = ?").get(userId) as any;
    return (row?.thinking_level as ThinkingLevel) || "off";
}

/**
 * Set the thinking level for a user.
 */
export function setThinkingLevel(userId: number, level: ThinkingLevel): void {
    const validLevels = ["off", "low", "medium", "high"];
    if (!validLevels.includes(level)) {
        throw new Error(`Invalid thinking level: ${level}`);
    }

    db.prepare(`
        INSERT INTO user_settings (user_id, thinking_level) 
        VALUES (?, ?) 
        ON CONFLICT(user_id) DO UPDATE SET thinking_level = excluded.thinking_level
    `).run(userId, level);
}
