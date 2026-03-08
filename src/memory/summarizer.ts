import OpenAI from "openai";
import { config } from "../config.js";
import { getRecentHistory, saveKnowledgeItem } from "./manager.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

/**
 * Summarize recent conversation history into a Knowledge Item.
 */
export async function summarizeHistory(userId: number, messageCount: number = 10): Promise<boolean> {
    const history = await getRecentHistory(userId, messageCount);
    if (history.length < 3) return false; // Not enough context to summarize

    const historyText = history.map(h => `User: ${h.message}\nAssistant: ${h.response}`).join("\n\n");

    const prompt = `You are the Gravity Claw Memory Processor.
Analyze the following conversation history and extract key facts, user preferences, or important insights into a single "Knowledge Item".

RULES:
1. Provide a concise TITLE.
2. Provide a detailed but efficient CONTENT summary.
3. Categorize it (e.g., "user_preference", "technical_fact", "project_context").
4. Return ONLY a JSON object: {"title": "...", "content": "...", "category": "..."}

HISTORY:
${historyText}`;

    try {
        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const rawJson = response.choices[0].message.content || "{}";
        const ki = JSON.parse(rawJson);

        if (ki.title && ki.content) {
            console.log(`🧠 [Memory] New Knowledge Item distilled: ${ki.title}`);
            const sourceIds = history.map(h => h.id);
            await saveKnowledgeItem(ki.title, ki.content, ki.category || "general", sourceIds);
            return true;
        }
    } catch (error) {
        console.error("Summarization error:", error);
    }
    return false;
}
