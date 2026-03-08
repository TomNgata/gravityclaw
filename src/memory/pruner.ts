import OpenAI from "openai";
import { config } from "../config.js";
import { supabase } from "./database.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

const BOX_CHARS_PER_TOKEN = 4;

export const pruner = {
    estimateTokens(text: string): number {
        return Math.ceil(text.length / BOX_CHARS_PER_TOKEN);
    },

    async summarizeChunk(userId: number, messages: { message: string, response: string }[]): Promise<string> {
        try {
            const textToSummarize = messages.map(m => `User: ${m.message}\nClaw: ${m.response}`).join("\n\n");
            const prompt = `Summarize the following conversation history concisely. Focus on key decisions, facts, and the current state of the task. This summary will be used as context for future parts of the conversation.\n\nCONVERSATION:\n${textToSummarize}`;

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

    async compactSession(userId: number): Promise<string> {
        const { data: history } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(20);

        if (!history || history.length < 5) return "Session is already compact.";
        return this.summarizeChunk(userId, history.reverse());
    }
};
