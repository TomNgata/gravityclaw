import cron from "node-cron";
import { supabase } from "../memory/database.js";
import { bot } from "../bot.js";
import { handleMessage } from "../agent.js";
import { parseNaturalLanguageToCron } from "./parser.js";
import { sendMorningBriefing } from "../proactive/briefing.js";
import { sendEveningRecap } from "../proactive/recap.js";

const activeJobs = new Map<number, cron.ScheduledTask>();

export interface ScheduledTaskRecord {
    id: number;
    user_id: number;
    cron_expression: string;
    prompt: string;
    status: "active" | "paused";
}

async function executeTask(task: ScheduledTaskRecord) {
    try {
        console.log(`⏰ Executing scheduled task ID ${task.id} for user ${task.user_id}: "${task.prompt}"`);
        const response = await handleMessage(
            `[SCHEDULED TASK TRIGGER] The user scheduled the following thought/action to occur now. Execute it and provide a response to the user:\n\nTask: ${task.prompt}`,
            task.user_id,
            task.user_id
        );
        await bot.api.sendMessage(task.user_id, `⏰ *Scheduled Task Triggered*\n\n${response}`, { parse_mode: "Markdown" });
    } catch (e) {
        console.error(`❌ Failed to execute scheduled task ID ${task.id}:`, e);
        await bot.api.sendMessage(task.user_id, `⚠️ Failed to execute scheduled task: "${task.prompt}"`);
    }
}

export async function loadSchedules() {
    console.log("⏰ Loading scheduled tasks from Supabase...");
    const { data, error } = await supabase.from('scheduled_tasks').select('*').eq('status', 'active');
    if (error) { console.error("❌ Failed to load schedules:", error); return; }
    for (const task of (data as ScheduledTaskRecord[])) {
        try {
            const job = cron.schedule(task.cron_expression, () => executeTask(task));
            activeJobs.set(task.id, job);
            console.log(`   - Task ID ${task.id}: "${task.prompt}" [${task.cron_expression}]`);
        } catch (e) {
            console.error(`   - Failed to load task ID ${task.id}:`, e);
        }
    }
    console.log(`⏰ Loaded ${activeJobs.size} active tasks.`);
}

export function startProactiveLoops() {
    console.log("⏰ Starting Proactive Check Loop...");
    cron.schedule("* * * * *", async () => {
        try {
            const date = new Date();
            const nowTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const { data: briefings } = await supabase.from('user_settings').select('user_id').eq('briefing_time', nowTimeStr);
            for (const b of (briefings || [])) sendMorningBriefing(b.user_id);
            const { data: recaps } = await supabase.from('user_settings').select('user_id').eq('recap_time', nowTimeStr);
            for (const r of (recaps || [])) sendEveningRecap(r.user_id);
        } catch (error) {
            console.error("Proactive Loop Error:", error);
        }
    });
}

export async function addSchedule(userId: number, scheduleText: string, prompt: string): Promise<{ success: boolean; message: string }> {
    let cronExp = scheduleText;
    if (scheduleText.split(" ").length !== 5) {
        const parsed = await parseNaturalLanguageToCron(scheduleText);
        if (!parsed) return { success: false, message: `Could not understand the schedule time: "${scheduleText}".` };
        cronExp = parsed;
    }
    if (!cron.validate(cronExp)) return { success: false, message: `The translated format [${cronExp}] is invalid.` };

    const { data, error } = await supabase.from('scheduled_tasks').insert([{ user_id: userId, cron_expression: cronExp, prompt, status: 'active' }]).select('id').single();
    if (error) { console.error("❌ Supabase Add Schedule Error:", error); return { success: false, message: "Failed to save to cloud." }; }

    const task: ScheduledTaskRecord = { id: data.id, user_id: userId, cron_expression: cronExp, prompt, status: "active" };
    const job = cron.schedule(cronExp, () => executeTask(task));
    activeJobs.set(data.id, job);
    return { success: true, message: `Task scheduled! (\`${cronExp}\`)` };
}

export async function getTasks(userId: number): Promise<ScheduledTaskRecord[]> {
    const { data, error } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId);
    return (error ? [] : data) as ScheduledTaskRecord[];
}

export async function pauseSchedule(userId: number, taskId: number): Promise<boolean> {
    const { error } = await supabase.from('scheduled_tasks').update({ status: 'paused' }).match({ id: taskId, user_id: userId });
    if (!error) {
        activeJobs.get(taskId)?.stop();
        activeJobs.delete(taskId);
        return true;
    }
    return false;
}

export async function resumeSchedule(userId: number, taskId: number): Promise<boolean> {
    const { data, error } = await supabase.from('scheduled_tasks').select('*').match({ id: taskId, user_id: userId }).single();
    if (data && !error) {
        await supabase.from('scheduled_tasks').update({ status: 'active' }).eq('id', taskId);
        if (activeJobs.has(taskId)) activeJobs.get(taskId)?.stop();
        const job = cron.schedule((data as ScheduledTaskRecord).cron_expression, () => executeTask(data as ScheduledTaskRecord));
        activeJobs.set(taskId, job);
        return true;
    }
    return false;
}

export async function deleteSchedule(userId: number, taskId: number): Promise<boolean> {
    const { error } = await supabase.from('scheduled_tasks').delete().match({ id: taskId, user_id: userId });
    if (!error) {
        activeJobs.get(taskId)?.stop();
        activeJobs.delete(taskId);
        return true;
    }
    return false;
}
