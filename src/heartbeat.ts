import OpenAI from "openai";
import { config } from "./config.js";
import { db } from "./memory/database.js";
import { bot } from "./bot.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

/**
 * The Heartbeat system allows Gravity Claw to "think" and act autonomously
 * even when not actively prompted by a user message.
 */
export function startHeartbeat() {
    console.log("💓 Heartbeat system initialized (60m cycle)");
    
    // Run every hour
    setInterval(async () => {
        console.log("💓 Heartbeat pulse: Analyzing internal state...");
        await performProactiveCheck();
    }, 60 * 60 * 1000);

    // Run once on startup (delayed slightly to ensure everything is online)
    setTimeout(() => performProactiveCheck(), 10000);
}

async function performProactiveCheck() {
    try {
        // 1. Get system stats
        const memoryCount = db.prepare("SELECT COUNT(*) as count FROM memories").get() as { count: number };
        const kiCount = db.prepare("SELECT COUNT(*) as count FROM knowledge_items").get() as { count: number };
        const lastConvo = db.prepare("SELECT * FROM conversations ORDER BY timestamp DESC LIMIT 1").get() as any;

        // 2. Formulate a "Proactive Thought"
        const prompt = `You are Gravity Claw's Heartbeat Monitor.
Current System State:
- Total Memories: ${memoryCount.count}
- Knowledge Items: ${kiCount.count}
- Last Activity: ${lastConvo ? lastConvo.timestamp : "None"}

Your goal is to perform a "Self-Reflection". 
- If the system has been idle, suggest a topic for the user to explore based on history.
- If memories are high but KIs are low, suggest a cleanup/summarization.
- Or simply provide a "Vibe Check" for the swarm's health.

Return a short (1-2 sentence) text status or insight for the internal logs.
If there is something TRULY important for the admin, start the message with "NOTIFICATION:".`;

        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100,
        });

        const thought = response.choices[0].message.content?.trim() || "System nominal.";
        console.log(`💓 Heartbeat Thought: ${thought}`);

        // 3. If it's a notification, send it to the first allowed user (admin)
        if (thought.startsWith("NOTIFICATION:") && config.allowedUserIds.length > 0) {
            const adminId = config.allowedUserIds[0];
            await bot.api.sendMessage(adminId, `💓 *Heartbeat Insight:*\n${thought.replace("NOTIFICATION:", "").trim()}`, {
                parse_mode: "Markdown"
            });
        }

    } catch (error) {
        console.error("💓 Heartbeat error:", error);
    }
}
