import { supabase } from "../memory/database.js";
import { handleMessage } from "../agent.js";
import { bot } from "../bot.js";

export async function sendEveningRecap(userId: number) {
    try {
        console.log(`🌙 Compiling Evening Recap for user ${userId}...`);

        const today = new Date().toISOString().split('T')[0];
        const { data: logs } = await supabase
            .from('conversations')
            .select('message, response')
            .eq('user_id', userId)
            .gte('timestamp', `${today}T00:00:00Z`);

        let historyContext = "";
        if (!logs || logs.length === 0) {
            historyContext = "The user did not interact with you today.";
        } else {
            const recentLogs = logs.slice(-10);
            historyContext = `The user exchanged ${logs.length} messages with you today. Here is a sample:\n`;
            for (const log of recentLogs) {
                historyContext += `User: ${log.message}\nAgent: ${log.response}\n\n`;
            }
        }

        const prompt = `[SYSTEM: EVENING RECAP]
It is evening. Send the user an Evening Recap summarizing their day with you.
Context: ${historyContext}

1. Provide a relaxing evening sign-off.
2. Summarize what you and the user discussed or accomplished today.
3. If no interactions, just bid them a good evening.

Keep the tone concise, reflective, and supportive. Return ONLY the message to send.`;

        const response = await handleMessage(prompt, userId);
        await bot.api.sendMessage(userId, `🌙 *Evening Recap*\n\n${response}`, { parse_mode: "Markdown" });
        console.log(`🌙 Evening Recap sent to ${userId}.`);
    } catch (e) {
        console.error(`❌ Failed to send Evening Recap to ${userId}:`, e);
    }
}
