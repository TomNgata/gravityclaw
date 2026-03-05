import { db } from "./database.js";

export interface Memory {
    id: number;
    content: string;
    category: string;
    timestamp: string;
}

/**
 * Save a piece of information to long-term memory.
 */
export function saveMemory(content: string, category: string = "facts"): number {
    const stmt = db.prepare("INSERT INTO memories (content, category) VALUES (?, ?)");
    const info = stmt.run(content, category);
    return info.lastInsertRowid as number;
}

/**
 * Search memories using SQLite FTS5.
 * Returns the most relevant matches for a query.
 */
export function searchMemories(query: string, limit: number = 5): Memory[] {
    if (!query || query.trim().length === 0) return [];

    const stmt = db.prepare(`
    SELECT m.* FROM memories m
    JOIN memories_fts f ON m.id = f.content_id
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

    // Clean query for FTS5: remove non-alphanumeric chars to avoid syntax errors
    const cleanedQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!cleanedQuery) return [];

    try {
        return stmt.all(cleanedQuery, limit) as Memory[];
    } catch (error) {
        console.error("Search error:", error);
        return [];
    }
}

/**
 * Log a conversation exchange for short-term history.
 */
export function logConversation(userId: number, message: string, response: string): void {
    const stmt = db.prepare("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)");
    stmt.run(userId, message, response);
}

/**
 * Get the most recent conversation history for a user.
 */
export function getRecentHistory(userId: number, limit: number = 10): { message: string, response: string }[] {
    const stmt = db.prepare(`
    SELECT message, response FROM conversations 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `);
    return (stmt.all(userId, limit) as any[]).reverse();
}
