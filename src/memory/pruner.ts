import OpenAI from "openai";
import { config } from "../config.js";
import { db } from "./database.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

const TOKEN_THRESHOLD = 4000; // Average tokens for pruning trigger
const BOX_CHARS_PER_TOKEN = 4; // Rough estimation

/**
 * Context Pruning Manager
 */
export const pruner = {
    /**
     * Estimates token count for a set of messages
     */
    estimateTokens(text: string): number {
        return Math.ceil(text.length / BOX_CHARS_PER_TOKEN);
    },

    /**
     * Summarizes a chunk of conversation history
     */
    async summarizeChunk(userId: number, messages: { message: string, response: string }[]): Promise<string> {
        try {
            const textToSummarize = messages.map(m => `User: ${m.message}\nClaw: ${m.response}`).join("\n\n");
            
            const prompt = `Summarize the following conversation history concisely. 
Focus on key decisions, facts, and the current state of the task.
This summary will be used as context for future parts of the conversation.

CONVERSATION:
${textToSummarize}`;

            const response = await openrouter.chat.completions.create({
                model: "stepfun/step-3.5-flash:free",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 300,
            });

            return response.choices[0].message.content?.trim() || "Summary unavailable.";
        } catch (error) {
            console.error("Pruning summarization error:", error);
            return "Error summarizing previous context.";
        }
    },

    /**
     * Manually compacts the session
     */
    async compactSession(userId: number): Promise<string> {
        const history = db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20").all(userId) as any[];
        
        if (history.length < 5) return "Session is already compact.";

        const summary = await this.summarizeChunk(userId, history.reverse());
        
        // We don't delete history (for memory search), but we "compact" the active session 
        // by creating a special Knowledge Item or a system memory that agent.ts can prioritize.
        // For /compact specifically, we'll return the summary.
        
        return summary;
    }
};
