import OpenAI from "openai";
import { config } from "./config.js";
import { db } from "./memory/database.js";
import { bot } from "./bot.js";
import { getRecommendationContext } from "./proactive/recommendations.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

/**
 * The Heartbeat system allows Gravity Claw to "think" and act autonomously
 * even when not actively prompted by a user message.
 */
export function startHeartbeat() {
    console.log("💓 Heartbeat system initialized (15m cycle)");
    
    // Run every 15 minutes
    setInterval(async () => {
        console.log("💓 Heartbeat pulse: Analyzing internal state...");
        await performProactiveCheck();
    }, 15 * 60 * 1000);

    // Run once on startup (delayed slightly to ensure everything is online)
    setTimeout(() => performProactiveCheck(), 10000);
}

async function performProactiveCheck() {
    try {
        if (config.allowedUserIds.length === 0) return;
        const adminId = config.allowedUserIds[0];

        // 1. Get system stats
        const memoryCount = db.prepare("SELECT COUNT(*) as count FROM memories").get() as { count: number };
        const kiCount = db.prepare("SELECT COUNT(*) as count FROM knowledge_items").get() as { count: number };
        const lastConvo = db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1").get(adminId) as any;

        // 2. Formulate a "Proactive Thought"
        const behaviorContext = getRecommendationContext(adminId);

        const prompt = `You are Gravity Claw's Heartbeat Monitor.
Current System State:
- Total Memories: ${memoryCount.count}
- Knowledge Items: ${kiCount.count}
- Last Activity: ${lastConvo ? lastConvo.timestamp : "None"}

Behavior Patterns:
${behaviorContext}

Your goal is to perform a "Self-Reflection" and determine if you should proactively message the user.
You MUST output valid JSON only, using this schema:
{
  "noteworthy": boolean, // true ONLY if there is an important insight, recommendation, or anomaly to share
  "message": "The message to send to the user (if noteworthy is true, otherwise empty)"
}

Do NOT send a message if everything is normal and there are no strong recommendations to make. Respect the user's focus. Use the Behavior Patterns strictly.`;

        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 150,
        });

        const content = response.choices[0].message.content?.trim() || "{}";
        const parsed = JSON.parse(content);

        console.log(`💓 Heartbeat Pulse Insight: Noteworthy=${parsed.noteworthy}`);

        // 3. If it's a notification, send it to the first allowed user (admin)
        if (parsed.noteworthy && parsed.message) {
            await bot.api.sendMessage(adminId, `💡 *Proactive Insight:*\n${parsed.message.trim()}`, {
                parse_mode: "Markdown"
            });
        }

    } catch (error) {
        console.error("💓 Heartbeat error:", error);
    }
}
