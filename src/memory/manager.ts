import { db } from "./database.js";
import OpenAI from "openai";
import { config } from "../config.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

export interface Memory {
    id: number;
    content: string;
    category: string;
    importance: number;
    metadata?: string;
    media_type?: string;
    media_url?: string;
    access_count: number;
    last_accessed?: string;
    embedding?: Buffer;
    timestamp: string;
}

export interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    category: string;
    access_count: number;
    last_accessed?: string;
    embedding?: Buffer;
    source_message_ids?: string;
    timestamp: string;
}

/**
 * Generate an embedding for a string using OpenRouter/OpenAI.
 */
async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openrouter.embeddings.create({
            model: "text-embedding-3-small", // Common embedding model
            input: text.replace(/\n/g, " "),
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Embedding error:", error);
        return new Array(1536).fill(0); // Return zero vector on error
    }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Save a piece of information to long-term memory with an embedding.
 */
export async function saveMemory(
    content: string, 
    category: string = "facts", 
    importance: number = 1,
    multimodal?: { type: string, url: string }
): Promise<number> {
    const embedding = await getEmbedding(content);
    const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

    const stmt = db.prepare(`
        INSERT INTO memories (content, category, embedding, importance, media_type, media_url) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
        const info = stmt.run(content, category, embeddingBlob, importance, multimodal?.type || null, multimodal?.url || null);
        const lastInsertId = info.lastInsertRowid;
        
        // Manual FTS Sync
        db.prepare("INSERT INTO memories_fts(content, content_id) VALUES (?, ?)").run(content, lastInsertId);
        
        return lastInsertId as number;
    });
    return tx();
}

/**
 * Search memories using semantic similarity.
 * Automatically updates access tracking for Self-Evolving memory.
 */
export async function searchMemoriesSemantic(query: string, limit: number = 5): Promise<Memory[]> {
    if (!query || query.trim().length === 0) return [];

    const queryEmbedding = await getEmbedding(query);
    
    // Fetch memories that have embeddings
    const memories = db.prepare("SELECT * FROM memories WHERE embedding IS NOT NULL").all() as Memory[];
    
    const scoredMemories = memories.map(m => {
        const mEmbedding = Array.from(new Float32Array(m.embedding!.buffer, m.embedding!.byteOffset, m.embedding!.byteLength / 4));
        return { ...m, score: cosineSimilarity(queryEmbedding, mEmbedding) };
    });

    const results = scoredMemories
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    // Self-Evolving: Update access metrics
    if (results.length > 0) {
        const updateStmt = db.prepare("UPDATE memories SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?");
        const transaction = db.transaction((ids: number[]) => {
            for (const id of ids) updateStmt.run(id);
        });
        transaction(results.map(r => r.id));
    }

    return results;
}

/**
 * Search memories using SQLite FTS5 (Keyword Fallback).
 */
export function searchMemoriesFTS(query: string, limit: number = 5): Memory[] {
    if (!query || query.trim().length === 0) return [];
    const stmt = db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts f ON m.id = f.content_id
        WHERE memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    `);
    const cleanedQuery = query.replace(/[^\w\s]/g, ' ').trim();
    return (cleanedQuery ? stmt.all(cleanedQuery, limit) : []) as Memory[];
}

/**
 * Legacy wrapper for searchMemories.
 */
export function searchMemories(query: string, limit: number = 5): Memory[] {
    return searchMemoriesFTS(query, limit);
}

/**
 * Save a Knowledge Item (KI).
 */
export async function saveKnowledgeItem(title: string, content: string, category: string = "general", sourceIds: number[] = []): Promise<number> {
    const embedding = await getEmbedding(`${title} ${content}`);
    const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);
    const sourceIdsJson = JSON.stringify(sourceIds);

    const stmt = db.prepare("INSERT INTO knowledge_items (title, content, category, embedding, source_message_ids) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(title, content, category, embeddingBlob, sourceIdsJson);
    return info.lastInsertRowid as number;
}

/**
 * Search Knowledge Items using semantic similarity.
 * Updates access tracking for Self-Evolving memory.
 */
export async function searchKnowledgeItems(query: string, limit: number = 3): Promise<KnowledgeItem[]> {
    const queryEmbedding = await getEmbedding(query);
    const items = db.prepare("SELECT * FROM knowledge_items WHERE embedding IS NOT NULL").all() as KnowledgeItem[];
    
    const scoredItems = items.map(item => {
        const itemEmbedding = Array.from(new Float32Array(item.embedding!.buffer, item.embedding!.byteOffset, item.embedding!.byteLength / 4));
        return { ...item, score: cosineSimilarity(queryEmbedding, itemEmbedding) };
    });

    const results = scoredItems
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    if (results.length > 0) {
        const updateStmt = db.prepare("UPDATE knowledge_items SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?");
        const transaction = db.transaction((ids: number[]) => {
            for (const id of ids) updateStmt.run(id);
        });
        transaction(results.map(r => r.id));
    }

    return results;
}

/**
 * Log a conversation exchange for short-term history.
 */
export function logConversation(userId: number, message: string, response: string): void {
    const stmt = db.prepare("INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)");
    stmt.run(userId, message, response);
}

/**
 * Self-Evolving: Reorganize and prune memory.
 * - Merges semantically similar memories.
 * - Applies decay to old/unused items.
 */
export async function reorganizeMemory(): Promise<{ merged: number, decayed: number }> {
    console.log("🧬 Starting Memory Self-Evolution...");
    
    const memories = db.prepare("SELECT * FROM memories WHERE embedding IS NOT NULL").all() as Memory[];
    let mergedCount = 0;
    let decayedCount = 0;

    // 1. Semantic Deduplication
    const processedIds = new Set<number>();
    for (let i = 0; i < memories.length; i++) {
        const m1 = memories[i];
        if (processedIds.has(m1.id)) continue;

        const m1Embedding = Array.from(new Float32Array(m1.embedding!.buffer, m1.embedding!.byteOffset, m1.embedding!.byteLength / 4));

        for (let j = i + 1; j < memories.length; j++) {
            const m2 = memories[j];
            if (processedIds.has(m2.id)) continue;

            const m2Embedding = Array.from(new Float32Array(m2.embedding!.buffer, m2.embedding!.byteOffset, m2.embedding!.byteLength / 4));
            const similarity = cosineSimilarity(m1Embedding, m2Embedding);

            if (similarity > 0.98) { // Extremely similar
                console.log(`🔗 Merging memory ${m2.id} into ${m1.id} (Similarity: ${similarity.toFixed(4)})`);
                
                // Keep the one with more access or higher importance
                const target = m1.access_count >= m2.access_count ? m1 : m2;
                const source = target === m1 ? m2 : m1;

                const newAccessCount = target.access_count + source.access_count;
                const newImportance = Math.max(target.importance, source.importance);

                try {
                    const mergeTx = db.transaction(() => {
                        db.prepare("UPDATE memories SET access_count = ?, importance = ? WHERE id = ?")
                            .run(newAccessCount, newImportance, target.id);
                        
                        // FTS Sync: Update target content if needed (not needed here since content stays the same)
                        // Delete source from both tables
                        db.prepare("DELETE FROM memories WHERE id = ?").run(source.id);
                        db.prepare("DELETE FROM memories_fts WHERE content_id = ?").run(source.id);
                    });
                    mergeTx();
                    
                    processedIds.add(source.id);
                    mergedCount++;
                    console.log(`✅ Successfully merged ${source.id} -> ${target.id}`);
                } catch (txError) {
                    console.error(`❌ Merge failed for ${source.id} -> ${target.id}:`, txError);
                    throw txError;
                }
                
                if (target === m2) break;
            }
        }
        processedIds.add(m1.id);
    }

    // 2. Importance Decay
    // Reduce importance of memories that haven't been accessed in 30 days and have low access count.
    const decayStmt = db.prepare(`
        UPDATE memories 
        SET importance = importance - 1 
        WHERE importance > 0 
        AND (last_accessed IS NULL OR last_accessed < datetime('now', '-30 days'))
        AND access_count < 5
    `);
    const info = decayStmt.run();
    decayedCount = info.changes;

    // 3. Cleanup: Archive or delete memories with 0 importance that are very old
    db.prepare("DELETE FROM memories WHERE importance <= 0 AND timestamp < datetime('now', '-90 days')").run();

    console.log(`✅ Evolution complete. Merged: ${mergedCount}, Decayed: ${decayedCount}`);
    return { merged: mergedCount, decayed: decayedCount };
}

/**
 * Get the most recent conversation history for a user.
 */
export function getRecentHistory(userId: number, limit: number = 10): { id: number, message: string, response: string }[] {
    const stmt = db.prepare(`
    SELECT id, message, response FROM conversations 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `);
    return (stmt.all(userId, limit) as any[]).reverse();
}
