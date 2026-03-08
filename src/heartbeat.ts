import OpenAI from "openai";
import { config } from "./config.js";
import { supabase } from "./memory/database.js";
import { bot } from "./bot.js";
import { getRecommendationContext } from "./proactive/recommendations.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

export function startHeartbeat() {
    console.log("💓 Heartbeat system initialized (15m cycle)");
    
    setInterval(async () => {
        console.log("💓 Heartbeat pulse: Analyzing internal state...");
        await performProactiveCheck();
    }, 15 * 60 * 1000);

    setTimeout(() => performProactiveCheck(), 10000);
}

async function performProactiveCheck() {
    try {
        if (config.allowedUserIds.length === 0) return;
        const adminId = config.allowedUserIds[0];

        // 1. Get system stats from Supabase
        const { count: memoryCount } = await supabase.from('memories').select('*', { count: 'exact', head: true });
        const { count: kiCount } = await supabase.from('knowledge_items').select('*', { count: 'exact', head: true });
        const { data: lastConvo } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', adminId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        const behaviorContext = getRecommendationContext(adminId);

        const prompt = `You are Gravity Claw's Heartbeat Monitor.
Current System State:
- Total Memories: ${memoryCount || 0}
- Knowledge Items: ${kiCount || 0}
- Last Activity: ${lastConvo ? lastConvo.timestamp : "None"}

Behavior Patterns:
${behaviorContext}

Your goal is to perform a "Self-Reflection" and determine if you should proactively message the user.
You MUST output valid JSON only, using this schema:
{
  "noteworthy": boolean,
  "message": "The message to send"
}

Do NOT send a message if everything is normal.`;

        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 150,
        });

        const content = response.choices[0].message.content?.trim() || "{}";
        const parsed = JSON.parse(content);

        console.log(`💓 Heartbeat Pulse Insight: Noteworthy=${parsed.noteworthy}`);

        if (parsed.noteworthy && parsed.message) {
            await bot.api.sendMessage(adminId, `💡 *Proactive Insight:*\n${parsed.message.trim()}`, {
                parse_mode: "Markdown"
            });
        }
    } catch (error) {
        console.error("💓 Heartbeat error:", error);
    }
}
