import { saveMemory, searchMemoriesFTS } from "../memory/manager.js";

// ── store_memory ───────────────────────────────────────────────────────

export const storeMemoryDef = {
    name: "store_memory",
    description: "Saves an important fact or piece of information to long-term memory for future recall.",
    input_schema: {
        type: "object" as const,
        properties: {
            content: {
                type: "string",
                description: "The information to remember (concise but complete).",
            },
            category: {
                type: "string",
                description: "A label for the memory (e.g., 'user_preference', 'project_detail', 'fact').",
                default: "facts",
            },
        },
        required: ["content"],
    },
};

export async function storeMemoryExec(input: Record<string, unknown>, chatId?: number): Promise<string> {
    const content = input.content as string;
    const category = (input.category as string) || "facts";
    if (!content) return "Error: content is required.";
    if (!chatId) return "Error: chatId is required for memory storage.";
    const id = await saveMemory(content, chatId, category);
    return `✅ Memory stored (ID: ${id}): "${content}"`;
}

// ── recall_memory ───────────────────────────────────────────────────────

export const recallMemoryDef = {
    name: "recall_memory",
    description: "Searches long-term memory for relevant information based on a text query.",
    input_schema: {
        type: "object" as const,
        properties: {
            query: {
                type: "string",
                description: "The search terms to look for in memory.",
            },
        },
        required: ["query"],
    },
};

export async function recallMemoryExec(input: Record<string, unknown>, chatId?: number): Promise<string> {
    const query = input.query as string;
    if (!query) return "Error: query is required.";
    if (!chatId) return "Error: chatId is required for memory recall.";
    // searchMemoriesSemantic is preferred now
    const { searchMemoriesSemantic } = await import("../memory/manager.js");
    const results = await searchMemoriesSemantic(query, chatId, 5);
    if (results.length === 0) return "No relevant memories found.";
    const formatted = results.map((r: any) => `[${r.category}] ${r.content}`).join("\n");
    return `Found these relevant memories:\n${formatted}`;
}
