import { db } from "../memory/database.js";
import { handleMessage } from "../agent.js";
import { bot } from "../bot.js";

/**
 * Compiles and sends an Evening Recap summarizing the day's activity.
 */
export async function sendEveningRecap(userId: number) {
    try {
        console.log(`🌙 Compiling Evening Recap for user ${userId}...`);

        // Fetch today's conversations
        const logs = db.prepare(`
            SELECT message, response 
            FROM conversations 
            WHERE user_id = ? 
              AND date(timestamp) = date('now')
        `).all(userId) as any[];

        let historyContext = "";
        if (logs.length === 0) {
            historyContext = "The user did not interact with you today.";
        } else {
            // Pick max 10 to fit in prompt limits
            const recentLogs = logs.slice(-10);
            historyContext = `The user exchanged ${logs.length} messages with you today. Here is a sample:\n`;
            for (const log of recentLogs) {
                historyContext += `User: ${log.message}\nAgent: ${log.response}\n\n`;
            }
        }

        // Formulate the prompt
        const prompt = `[SYSTEM: EVENING RECAP]
It is evening. You are to proactively send the user an Evening Recap summarizing their day with you.
Here is the context of what happened today:
${historyContext}

Your goal:
1. Provide a relaxing evening sign-off.
2. Summarize what you and the user discussed or accomplished today.
3. If they had no interactions, just bid them a good evening and ask if they need anything before tomorrow.

Keep the tone concise, reflective, and supportive. Return ONLY the message to send.`;

        const response = await handleMessage(prompt, userId);

        await bot.api.sendMessage(userId, `🌙 *Evening Recap*\n\n${response}`, { parse_mode: "Markdown" });
        console.log(`🌙 Evening Recap sent successfully to ${userId}.`);
    } catch (e) {
        console.error(`❌ Failed to send Evening Recap to ${userId}:`, e);
    }
}
