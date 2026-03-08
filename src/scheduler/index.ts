import cron from "node-cron";
import { db } from "../memory/database.js";
import { bot } from "../bot.js";
import { handleMessage } from "../agent.js";
import { parseNaturalLanguageToCron } from "./parser.js";
import { sendMorningBriefing } from "../proactive/briefing.js";
import { sendEveningRecap } from "../proactive/recap.js";

// Store active scheduled tasks in memory for easy reference/cancellation
const activeJobs = new Map<number, cron.ScheduledTask>();

export interface ScheduledTaskRecord {
    id: number;
    user_id: number;
    cron_expression: string;
    prompt: string;
    status: "active" | "paused";
}

/**
 * Executes a task when its cron schedule hits.
 */
async function executeTask(task: ScheduledTaskRecord) {
    try {
        console.log(`⏰ Executing scheduled task ID ${task.id} for user ${task.user_id}: "${task.prompt}"`);
        
        // Let the swarm handle the prompt as if the user sent it directly
        const response = await handleMessage(
            `[SCHEDULED TASK TRIGGER] The user scheduled the following thought/action to occur now. Execute it and provide a response to the user:\n\nTask: ${task.prompt}`,
            task.user_id
        );

        await bot.api.sendMessage(task.user_id, `⏰ *Scheduled Task Triggered*\n\n${response}`, { parse_mode: "Markdown" });
    } catch (e) {
        console.error(`❌ Failed to execute scheduled task ID ${task.id}:`, e);
        await bot.api.sendMessage(task.user_id, `⚠️ Failed to execute scheduled task: "${task.prompt}"`);
    }
}

/**
 * Loads and starts all active scheduled tasks from the database.
 */
export function loadSchedules() {
    console.log("⏰ Loading scheduled tasks...");
    const tasks = db.prepare("SELECT * FROM scheduled_tasks WHERE status = 'active'").all() as ScheduledTaskRecord[];

    for (const task of tasks) {
        try {
            const job = cron.schedule(task.cron_expression, () => executeTask(task));
            activeJobs.set(task.id, job);
            console.log(`   - Task ID ${task.id} loaded: "${task.prompt}" [${task.cron_expression}]`);
        } catch (e) {
            console.error(`   - Failed to load task ID ${task.id} (Invalid cron?): ${task.cron_expression}`, e);
        }
    }
    console.log(`⏰ Loaded ${activeJobs.size} active tasks.`);
}

/**
 * Starts a 1-minute ticker to check for Morning Briefings and Evening Recaps based on user_settings.
 */
export function startProactiveLoops() {
    console.log("⏰ Starting Proactive Check Loop...");

    cron.schedule("* * * * *", () => {
        try {
            const date = new Date();
            const hhStr = String(date.getHours()).padStart(2, '0');
            const mmStr = String(date.getMinutes()).padStart(2, '0');
            const nowTimeStr = `${hhStr}:${mmStr}`;

            // Check briefings
            const briefings = db.prepare("SELECT user_id FROM user_settings WHERE briefing_time = ?").all(nowTimeStr) as { user_id: number }[];
            for (const b of briefings) {
                sendMorningBriefing(b.user_id);
            }

            // Check recaps
            const recaps = db.prepare("SELECT user_id FROM user_settings WHERE recap_time = ?").all(nowTimeStr) as { user_id: number }[];
            for (const r of recaps) {
                sendEveningRecap(r.user_id);
            }

        } catch (error) {
            console.error("Proactive Loop Error:", error);
        }
    });
}

/**
 * Adds a new scheduled task.
 */
export async function addSchedule(userId: number, scheduleText: string, prompt: string): Promise<{ success: boolean; message: string }> {
    let cronExp = scheduleText;

    // Check if it's a raw cron string. Very naive check: 5 parts separated by space.
    if (scheduleText.split(" ").length !== 5) {
        const parsed = await parseNaturalLanguageToCron(scheduleText);
        if (!parsed) {
            return { success: false, message: `Could not understand the schedule time: "${scheduleText}". Please try rephrasing (e.g., "every day at 9am").` };
        }
        cronExp = parsed;
    }

    if (!cron.validate(cronExp)) {
        return { success: false, message: `The translated format [${cronExp}] is not a valid cron expression.` };
    }

    const info = db.prepare("INSERT INTO scheduled_tasks (user_id, cron_expression, prompt, status) VALUES (?, ?, ?, ?)").run(userId, cronExp, prompt, 'active');
    const newId = info.lastInsertRowid as number;

    const task: ScheduledTaskRecord = { id: newId, user_id: userId, cron_expression: cronExp, prompt, status: "active" };
    const job = cron.schedule(cronExp, () => executeTask(task));
    activeJobs.set(newId, job);

    return { success: true, message: `Task scheduled successfully! (Internal format: \`${cronExp}\`)` };
}

/**
 * Get all tasks for a user.
 */
export function getTasks(userId: number): ScheduledTaskRecord[] {
    return db.prepare("SELECT * FROM scheduled_tasks WHERE user_id = ?").all(userId) as ScheduledTaskRecord[];
}

/**
 * Pauses a task.
 */
export function pauseSchedule(userId: number, taskId: number): boolean {
    const info = db.prepare("UPDATE scheduled_tasks SET status = 'paused' WHERE id = ? AND user_id = ?").run(taskId, userId);
    if (info.changes > 0) {
        const job = activeJobs.get(taskId);
        if (job) {
            job.stop();
            activeJobs.delete(taskId);
        }
        return true;
    }
    return false;
}

/**
 * Resumes a paused task.
 */
export function resumeSchedule(userId: number, taskId: number): boolean {
    const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?").get(taskId, userId) as ScheduledTaskRecord | undefined;
    if (task) {
        db.prepare("UPDATE scheduled_tasks SET status = 'active' WHERE id = ?").run(taskId);
        task.status = "active";
        
        // Make sure it's not already running
        if (activeJobs.has(taskId)) {
            activeJobs.get(taskId)?.stop();
        }

        const job = cron.schedule(task.cron_expression, () => executeTask(task));
        activeJobs.set(taskId, job);
        return true;
    }
    return false;
}

/**
 * Deletes a task.
 */
export function deleteSchedule(userId: number, taskId: number): boolean {
    const info = db.prepare("DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?").run(taskId, userId);
    if (info.changes > 0) {
        const job = activeJobs.get(taskId);
        if (job) {
            job.stop();
            activeJobs.delete(taskId);
        }
        return true;
    }
    return false;
}
