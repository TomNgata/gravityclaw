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
    embedding?: Buffer;
    timestamp: string;
}

export interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    category: string;
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
export async function saveMemory(content: string, category: string = "facts", importance: number = 1): Promise<number> {
    const embedding = await getEmbedding(content);
    const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

    const stmt = db.prepare("INSERT INTO memories (content, category, embedding, importance) VALUES (?, ?, ?, ?)");
    const info = stmt.run(content, category, embeddingBlob, importance);
    return info.lastInsertRowid as number;
}

/**
 * Search memories using semantic similarity.
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

    return scoredMemories
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
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
 */
export async function searchKnowledgeItems(query: string, limit: number = 3): Promise<KnowledgeItem[]> {
    const queryEmbedding = await getEmbedding(query);
    const items = db.prepare("SELECT * FROM knowledge_items WHERE embedding IS NOT NULL").all() as KnowledgeItem[];
    
    const scoredItems = items.map(item => {
        const itemEmbedding = Array.from(new Float32Array(item.embedding!.buffer, item.embedding!.byteOffset, item.embedding!.byteLength / 4));
        return { ...item, score: cosineSimilarity(queryEmbedding, itemEmbedding) };
    });

    return scoredItems
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
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
export function getRecentHistory(userId: number, limit: number = 10): { id: number, message: string, response: string }[] {
    const stmt = db.prepare(`
    SELECT id, message, response FROM conversations 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `);
    return (stmt.all(userId, limit) as any[]).reverse();
}
