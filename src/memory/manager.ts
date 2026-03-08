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
    timestamp?: string;
    similarity?: number;
    chat_id?: number;
}

export interface KnowledgeItem {
    id: number;
    title: string;
    content: string;
    category: string;
    access_count: number;
    last_accessed?: string;
    source_message_ids?: string;
    timestamp?: string;
    similarity?: number;
    chat_id?: number;
}

/**
 * Generate a 1536-dimensional embedding using OpenRouter's text-embedding-3-small.
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
        return new Array(1536).fill(0); // Zero vector fallback
    }
}

/**
 * Save a new memory with a real pgvector embedding.
 */
export async function saveMemory(
    content: string,
    chatId: number,
    category: string = "facts",
    importance: number = 1,
    multimodal?: { type: string, url: string }
): Promise<number> {
    const embedding = await getEmbedding(content);

    const { data, error } = await supabase
        .from('memories')
        .insert([{
            content,
            chat_id: chatId,
            category,
            importance,
            media_type: multimodal?.type || null,
            media_url: multimodal?.url || null,
            embedding: `[${embedding.join(",")}]`  // Supabase expects vector as string literal
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
 * True semantic search using pgvector cosine similarity via Supabase RPC.
 * Falls back to ILIKE keyword search if no embeddings exist yet.
 */
export async function searchMemoriesSemantic(query: string, chatId: number, limit: number = 5): Promise<Memory[]> {
    if (!query || query.trim().length === 0) return [];

    const queryEmbedding = await getEmbedding(query);

    // Try vector search first
    const { data: vectorResults, error: vectorError } = await supabase.rpc('match_memories', {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: 0.40,
        match_count: limit,
        p_chat_id: chatId
    });

    if (!vectorError && vectorResults && vectorResults.length > 0) {
        console.log(`🧠 Semantic search found ${vectorResults.length} vector matches`);
        // Update access metrics (fire-and-forget)
        const ids = vectorResults.map((m: any) => m.id);
        supabase.from('memories')
            .update({ last_accessed: new Date().toISOString(), access_count: supabase.rpc('increment', { x: 1 }) as any })
            .in('id', ids)
            .then();
        return vectorResults as Memory[];
    }

    // Fallback: keyword search when no embeddings exist yet
    console.log(`💬 Falling back to keyword search (no vector matches)`);
    const { data, error } = await supabase
        .from('memories')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('importance', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("❌ Supabase Search Error:", error);
        return [];
    }

    return data as Memory[];
}

/**
 * Keyword search wrapper (for tools that need it explicitly).
 */
export async function searchMemoriesFTS(query: string, limit: number = 5): Promise<Memory[]> {
    if (!query || query.trim().length === 0) return [];
    const { data, error } = await supabase
        .from('memories')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('importance', { ascending: false })
        .limit(limit);
    return (error ? [] : data) as Memory[];
}

/**
 * Save a Knowledge Item with a real pgvector embedding.
 */
export async function saveKnowledgeItem(
    title: string,
    content: string,
    category: string = "general",
    sourceIds: number[] = []
): Promise<number> {
    const embedding = await getEmbedding(`${title} ${content}`);

    const { data, error } = await supabase
        .from('knowledge_items')
        .insert([{
            title,
            content,
            category,
            source_message_ids: JSON.stringify(sourceIds),
            embedding: `[${embedding.join(",")}]`
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
 * True semantic search on knowledge items using pgvector.
 */
export async function searchKnowledgeItems(query: string, limit: number = 3): Promise<KnowledgeItem[]> {
    const queryEmbedding = await getEmbedding(query);

    const { data: vectorResults, error: vectorError } = await supabase.rpc('match_knowledge_items', {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: 0.40,
        match_count: limit
    });

    if (!vectorError && vectorResults && vectorResults.length > 0) {
        console.log(`🧠 KI Semantic search found ${vectorResults.length} matches`);
        return vectorResults as KnowledgeItem[];
    }

    // Fallback
    const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .ilike('content', `%${query}%`)
        .limit(limit);

    return (error ? [] : data) as KnowledgeItem[];
}

/**
 * Log a conversation exchange.
 */
export async function logConversation(userId: number, chatId: number, message: string, response: string): Promise<void> {
    const { error } = await supabase
        .from('conversations')
        .insert([{ user_id: userId, chat_id: chatId, message, response }]);

    if (error) console.error("❌ Supabase Log Conversation Error:", error);
}

/**
 * Get recent conversation history for a user.
 */
export async function getRecentHistory(
    chatId: number,
    limit: number = 10
): Promise<{ id: number, message: string, response: string }[]> {
    const { data, error } = await supabase
        .from('conversations')
        .select('id, message, response')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("❌ Supabase Get History Error:", error);
        return [];
    }

    return data.reverse();
}

/**
 * Memory self-evolution placeholder (future RPC-based implementation).
 */
export async function reorganizeMemory(): Promise<{ merged: number, decayed: number }> {
    console.log("🧬 Supabase Memory Self-Evolution pending RPC implementation.");
    return { merged: 0, decayed: 0 };
}
