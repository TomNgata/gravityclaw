import { db } from "../memory/database.js";

/**
 * Analyzes database metrics to detect behavior patterns and provide proactive suggestions.
 */
export function getRecommendationContext(userId: number): string {
    try {
        const memoryCount = db.prepare("SELECT COUNT(*) as c FROM memories").get() as any;
        const taskCount = db.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE user_id = ?").get(userId) as any;
        const kiCount = db.prepare("SELECT COUNT(*) as c FROM knowledge_items").get() as any;
        
        // Find if they use the bot heavily for simple commands vs deep conversations
        const recentLogs = db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20").all(userId) as any[];
        
        let contextMatches = "";
        
        if (taskCount.c > 5) {
            contextMatches += "- The user has many scheduled tasks active. You could recommend they review their tasks using /tasks to ensure they are all still relevant.\n";
        }
        
        if (memoryCount.c > 30 && kiCount.c < 5) {
            contextMatches += "- The user has built up a significant memory bank of facts, but very few summarized Knowledge Items. Recommend they trigger a data synthesis session.\n";
        }

        if (recentLogs.length > 15) {
            contextMatches += "- The user has been highly active recently. If they seem to be repeating tasks, suggest they create a new Skill markdown file in the /skills directory to automate it.\n";
        }

        return contextMatches || "- No specific behavioral anomalies detected. Continue silent operation unless there is a critical system insight.";
    } catch (e) {
        console.error("Failed to generate recommendation context:", e);
        return "- Unable to retrieve user behavior patterns.";
    }
}
