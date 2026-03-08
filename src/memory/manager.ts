import { supabase } from "./database.js";
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
    embedding?: string; // Now stored as TEXT (placeholder)
    timestamp: string;
}

export interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    category: string;
    access_count: number;
    last_accessed?: string;
    embedding?: string; // Stored as TEXT
    source_message_ids?: string;
    timestamp: string;
}

/**
 * Generate an embedding for a string using OpenRouter/OpenAI.
 */
async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openrouter.embeddings.create({
            model: "text-embedding-3-small",
            input: text.replace(/\n/g, " "),
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Embedding error:", error);
        return new Array(1536).fill(0);
    }
}

/**
 * Save a piece of information to long-term memory.
 * Note: SQLite FTS5 logic is replaced by Postgres GIN/ILike or Supabase Search.
 */
export async function saveMemory(
    content: string, 
    category: string = "facts", 
    importance: number = 1,
    multimodal?: { type: string, url: string }
): Promise<number> {
    // Note: Embedding storage is temporarily disabled or stored as string due to hex data issues.
    // For now, we save the text content to ensure character continuity.
    const { data, error } = await supabase
        .from('memories')
        .insert([{
            content,
            category,
            importance,
            media_type: multimodal?.type || null,
            media_url: multimodal?.url || null
        }])
        .select('id')
        .single();

    if (error) {
        console.error("❌ Supabase Save Memory Error:", error);
        throw error;
    }

    return data.id;
}

/**
 * Search memories using keyword search (Postgres ILIKE fallback for now).
 * In a future step, we can re-enable semantic search via pgvector on Supabase.
 */
export async function searchMemoriesSemantic(query: string, limit: number = 5): Promise<Memory[]> {
    if (!query || query.trim().length === 0) return [];

    const { data, error } = await supabase
        .from('memories')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('importance', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("❌ Supabase Search Semantic Error:", error);
        return [];
    }

    // Update access metrics asynchronously
    if (data.length > 0) {
        const ids = data.map(m => m.id);
        // Supabase doesn't support complex 'access_count = access_count + 1' easily in a single call without RPC.
        // For simplicity during migration, we'll just update the last_accessed.
        supabase
            .from('memories')
            .update({ last_accessed: new Date().toISOString() })
            .in('id', ids)
            .then(({ error: updateError }) => {
                if (updateError) console.warn("⚠️ Failed to update access time:", updateError);
            });
    }

    return data as Memory[];
}

/**
 * Keyword search wrapper (replaces SQLite FTS5).
 */
export async function searchMemoriesFTS(query: string, limit: number = 5): Promise<Memory[]> {
    return searchMemoriesSemantic(query, limit);
}

/**
 * Save a Knowledge Item (KI).
 */
export async function saveKnowledgeItem(title: string, content: string, category: string = "general", sourceIds: number[] = []): Promise<number> {
    const { data, error } = await supabase
        .from('knowledge_items')
        .insert([{
            title,
            content,
            category,
            source_message_ids: JSON.stringify(sourceIds)
        }])
        .select('id')
        .single();

    if (error) {
        console.error("❌ Supabase Save KI Error:", error);
        throw error;
    }

    return data.id;
}

/**
 * Search Knowledge Items.
 */
export async function searchKnowledgeItems(query: string, limit: number = 3): Promise<KnowledgeItem[]> {
    const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .ilike('content', `%${query}%`)
        .limit(limit);

    if (error) {
        console.error("❌ Supabase Search KI Error:", error);
        return [];
    }

    return data as KnowledgeItem[];
}

/**
 * Log a conversation exchange for short-term history.
 */
export async function logConversation(userId: number, message: string, response: string): Promise<void> {
    const { error } = await supabase
        .from('conversations')
        .insert([{
            user_id: userId,
            message,
            response
        }]);

    if (error) {
        console.error("❌ Supabase Log Conversation Error:", error);
    }
}

/**
 * Get the most recent conversation history for a user.
 */
export async function getRecentHistory(userId: number, limit: number = 10): Promise<{ id: number, message: string, response: string }[]> {
    const { data, error } = await supabase
        .from('conversations')
        .select('id, message, response')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("❌ Supabase Get History Error:", error);
        return [];
    }

    return data.reverse();
}

/**
 * Self-Evolving: Reorganize and prune memory. 
 * Placeholder for cloud-native evolution logic.
 */
export async function reorganizeMemory(): Promise<{ merged: number, decayed: number }> {
    console.log("🧬 Supabase Memory Self-Evolution logic pending RPC implementation.");
    return { merged: 0, decayed: 0 };
}
