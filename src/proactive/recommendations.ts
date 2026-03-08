import { supabase } from "../memory/database.js";

/**
 * Analyzes Supabase metrics to detect behavior patterns and provide proactive suggestions.
 * Returns a context string synchronously from cached/recent data.
 * Note: Full async version could await these calls; for heartbeat use, we return a static string and let heartbeat handle the async calls itself.
 */
export function getRecommendationContext(_userId: number): string {
    // Return a lightweight static recommendation context.
    // Full async metrics are fetched directly in heartbeat.ts.
    return "- Monitoring active. Check /tasks for scheduled items. Use /compact to distill session context if conversations grow long.";
}

/**
 * Async version for use in proactive systems that can await.
 */
export async function getRecommendationContextAsync(userId: number): Promise<string> {
    try {
        const { count: memoryCount } = await supabase.from('memories').select('*', { count: 'exact', head: true });
        const { count: taskCount } = await supabase.from('scheduled_tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        const { count: kiCount } = await supabase.from('knowledge_items').select('*', { count: 'exact', head: true });
        const { data: recentLogs } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(20);

        let contextMatches = "";

        if ((taskCount || 0) > 5) {
            contextMatches += "- The user has many scheduled tasks active. Recommend they review tasks using /tasks.\n";
        }
        if ((memoryCount || 0) > 30 && (kiCount || 0) < 5) {
            contextMatches += "- Significant memory bank with few Knowledge Items. Recommend a data synthesis session.\n";
        }
        if ((recentLogs?.length || 0) > 15) {
            contextMatches += "- The user has been highly active. If repeating tasks, suggest creating a Skill markdown file in /skills.\n";
        }

        return contextMatches || "- No specific behavioral anomalies detected. Continue silent operation unless there is a critical system insight.";
    } catch (e) {
        console.error("Failed to generate recommendation context:", e);
        return "- Unable to retrieve user behavior patterns.";
    }
}
