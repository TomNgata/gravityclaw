import { handleMessage } from "../agent.js";
import { getTasks } from "../scheduler/index.js";
import { bot } from "../bot.js";

/**
 * Compiles and sends a Morning Briefing to the user.
 */
export async function sendMorningBriefing(userId: number) {
    try {
        console.log(`🌅 Compiling Morning Briefing for user ${userId}...`);

        // Gather scheduled tasks for context
        const tasks = await getTasks(userId);
        let taskContext = (tasks.length > 0) 
            ? `\nThe user has the following scheduled tasks today:\n` + tasks.map(t => `- [${t.cron_expression}] ${t.prompt}`).join("\n") 
            : "\nThe user has no scheduled tasks.";

        // Formulate the prompt for the swarm
        const prompt = `[SYSTEM: MORNING BRIEFING]
It is morning. You are to proactively send the user a Morning Briefing.
Please include:
1. A warm, energetic greeting.
2. A generic/simulated summary of "today's weather" and "top tech news" (since we lack live APIs for these right now, invent something plausible but clearly state it's a simulation/placeholder for the feature).
3. A summary of their scheduled tasks (if any).${taskContext}

Keep it concise, structured, and pleasant. Return ONLY the message you want sent to the user.`;

        // Direct the swarm to generate the briefing
        const response = await handleMessage(prompt, userId, userId);

        await bot.api.sendMessage(userId, `🌅 *Morning Briefing*\n\n${response}`, { parse_mode: "Markdown" });
        console.log(`🌅 Morning Briefing sent successfully to ${userId}.`);
    } catch (e) {
        console.error(`❌ Failed to send Morning Briefing to ${userId}:`, e);
    }
}
