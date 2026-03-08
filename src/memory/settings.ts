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

// ── Briefing and Recap Times ──────────────────────────────────────────

export function getBriefingTime(userId: number): string {
    const row = db.prepare("SELECT briefing_time FROM user_settings WHERE user_id = ?").get(userId) as any;
    return row?.briefing_time || "08:00";
}

export function setBriefingTime(userId: number, timeStr: string): boolean {
    // Basic validation for HH:MM
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return false;

    db.prepare(`
        INSERT INTO user_settings (user_id, briefing_time) 
        VALUES (?, ?) 
        ON CONFLICT(user_id) DO UPDATE SET briefing_time = excluded.briefing_time
    `).run(userId, timeStr);
    return true;
}

export function getRecapTime(userId: number): string {
    const row = db.prepare("SELECT recap_time FROM user_settings WHERE user_id = ?").get(userId) as any;
    return row?.recap_time || "20:00";
}

export function setRecapTime(userId: number, timeStr: string): boolean {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return false;

    db.prepare(`
        INSERT INTO user_settings (user_id, recap_time) 
        VALUES (?, ?) 
        ON CONFLICT(user_id) DO UPDATE SET recap_time = excluded.recap_time
    `).run(userId, timeStr);
    return true;
}
