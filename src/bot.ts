import { Bot, Context, webhookCallback } from "grammy";
import { config } from "./config.js";
import { handleMessage } from "./agent.js";
import { transcribeAudio } from "./voice/stt.js";
import { synthesizeSpeech } from "./voice/tts.js";
import { join } from "path";
import { existsSync, mkdirSync, unlinkSync, createWriteStream } from "fs";
import { finished } from "stream/promises";
import axios from "axios";

import { pruner } from "./memory/pruner.js";
import { getThinkingLevel, setThinkingLevel, ThinkingLevel, setBriefingTime, setRecapTime } from "./memory/settings.js";
import { addSchedule, getTasks, pauseSchedule, resumeSchedule, deleteSchedule } from "./scheduler/index.js";

// ── Create bot ──────────────────────────────────────────────────────────
export const bot = new Bot(config.telegramBotToken);

// Webhook handler for cloud nodes
export const handleUpdate = webhookCallback(bot, "http", {
    secretToken: config.secretToken
});

// ── Security & Admin Logic ──────────────────────────────────────────
bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.allowedUserIds.includes(userId)) {
        console.warn(`🔒 Access Denied for User ID: ${userId}`);
        return;
    }
    await next();
});

async function isAdmin(ctx: Context): Promise<boolean> {
    if (ctx.chat?.type === "private") return true;
    const member = await ctx.getChatMember(ctx.from!.id);
    return ["administrator", "creator"].includes(member.status);
}

// ── Handle /start command ──────────────────────────────────────────────
bot.command("start", async (ctx) => {
    const welcome = `🤖 **Gravity Claw Online**
Version: Level 10 (Multi-Modal & Proactive)

I am now a more resilient multi-model agentic swarm, dynamically routing your requests to specialized experts.

NEW FEATURES:
- 🕸️ **Knowledge Graph**: I remember interconnected entities and relationships.
- 📉 **Context Pruning**: Use /compact to distill our conversation.

How can I help you today?`;
    await ctx.reply(welcome, { parse_mode: "Markdown" });
});

// ── Handle /compact command ───────────────────────────────────────────
bot.command("compact", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }

    await ctx.replyWithChatAction("typing");
    await ctx.reply("📉 *Compacting session context...*", { parse_mode: "Markdown" });
    
    try {
        const summary = await pruner.compactSession(userId);
        await ctx.reply(`✅ *Session Compacted*\n\n**Summary so far:**\n${summary}`, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Compact error:", error);
        await ctx.reply("⚠️ Failed to compact session.");
    }
});

// ── Handle /think command ─────────────────────────────────────────────
bot.command("think", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }

    const args = ctx.match.trim().toLowerCase();
    const validLevels = ["off", "low", "medium", "high"];

    if (!args || !validLevels.includes(args)) {
        const currentLevel = await getThinkingLevel(userId);
        await ctx.reply(
            `🧠 *Thinking Level Configuration*\n\nCurrent Level: \`${currentLevel}\`\n\nUsage: \`/think [off|low|medium|high]\`\n- \`off\`: Default fast responses.\n- \`low\`: Brief step-by-step reasoning.\n- \`medium\`: Detailed step-by-step reasoning.\n- \`high\`: Exhaustive, multi-angle reasoning.`,
            { parse_mode: "Markdown" }
        );
        return;
    }

    try {
        await setThinkingLevel(userId, args as ThinkingLevel);
        await ctx.reply(`✅ *Thinking Level set to:* \`${args}\``, { parse_mode: "Markdown" });
    } catch (e) {
        console.error("Thinking level error:", e);
        console.error("Thinking level error:", e);
        await ctx.reply("⚠️ Failed to update thinking level.");
    }
});

// ── Handle /set_briefing & /set_recap ─────────────────────────────────
bot.command("set_briefing", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }

    const timeStr = ctx.match.trim();
    if (await setBriefingTime(userId, timeStr)) {
        await ctx.reply(`🌅 Morning Briefing time updated to \`${timeStr}\`.`, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`⚠️ Usage: \`/set_briefing HH:MM\` (24-hour format).`, { parse_mode: "Markdown" });
    }
});

bot.command("set_recap", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }

    const timeStr = ctx.match.trim();
    if (await setRecapTime(userId, timeStr)) {
        await ctx.reply(`🌙 Evening Recap time updated to \`${timeStr}\`.`, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`⚠️ Usage: \`/set_recap HH:MM\` (24-hour format).`, { parse_mode: "Markdown" });
    }
});

// ── Handle /schedule commands ──────────────────────────────────────────
bot.command("schedule", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }

    const input = ctx.match.trim();
    if (!input.includes("-")) {
        await ctx.reply(`🗓️ *Usage:* \`/schedule [time string] - [task description]\`\n\nExample: \`/schedule every day at 9am - Remind me to check emails\``, { parse_mode: "Markdown" });
        return;
    }

    const parts = input.split("-");
    const timeString = parts[0].trim();
    const prompt = parts.slice(1).join("-").trim();

    await ctx.replyWithChatAction("typing");
    const result = await addSchedule(userId, timeString, prompt);
    
    if (result.success) {
        await ctx.reply(`✅ ${result.message}`, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`⚠️ ${result.message}`);
    }
});

bot.command("tasks", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const tasks = await getTasks(userId);
    if (tasks.length === 0) {
        await ctx.reply("📋 You have no scheduled tasks.");
        return;
    }

    let msg = "📋 *Your Scheduled Tasks:*\n\n";
    for (const t of tasks) {
        const icon = t.status === "active" ? "🟢" : "⏸️";
        msg += `**ID ${t.id}** ${icon} [${t.cron_expression}]\n📝 ${t.prompt}\n\n`;
    }
    msg += `Use \`/pause_task [id]\`, \`/resume_task [id]\`, or \`/delete_task [id]\`.`;
    await ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.command("pause_task", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }
    const taskId = parseInt(ctx.match.trim());

    const success = await pauseSchedule(userId, taskId);
    await ctx.reply(success ? `⏸️ Task ${taskId} paused.` : `⚠️ Task ${taskId} not found.`);
});

bot.command("resume_task", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }
    const taskId = parseInt(ctx.match.trim());

    const success = await resumeSchedule(userId, taskId);
    await ctx.reply(success ? `▶️ Task ${taskId} resumed.` : `⚠️ Task ${taskId} not found.`);
});

bot.command("delete_task", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx))) {
        await ctx.reply("⚠️ Admin-only command.");
        return;
    }
    const taskId = parseInt(ctx.match.trim());

    const success = await deleteSchedule(userId, taskId);
    await ctx.reply(success ? `🗑️ Task ${taskId} deleted.` : `⚠️ Task ${taskId} not found.`);
});

// ── Handle Voice Messages ──────────────────────────────────────────────
bot.on("message:voice", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.replyWithChatAction("record_voice");

    try {
        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;

        const tempDir = join(process.cwd(), "temp");
        if (!existsSync(tempDir)) mkdirSync(tempDir);
        const filePath = join(tempDir, `${file.file_id}.ogg`);

        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        const writer = createWriteStream(filePath);
        response.data.pipe(writer);
        await finished(writer);

        const transcribedText = await transcribeAudio(filePath);
        console.log(`🎤 Voice from ${userId} in ${ctx.chat.id}: ${transcribedText}`);

        const agentResponse = await handleMessage(transcribedText, userId, ctx.chat.id);
        await ctx.reply(agentResponse, { parse_mode: "Markdown" });

        unlinkSync(filePath);
    } catch (error) {
        console.error("Voice handler error:", error);
        await ctx.reply("⚠️ Sorry, I couldn't process your voice message.");
    }
});

// ── Handle Photos (Vision) ─────────────────────────────────────────────
bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.replyWithChatAction("typing");

    try {
        const file = await ctx.getFile();
        const imageUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
        const caption = ctx.message.caption || "What is in this image?";
        console.log(`📸 Photo from ${userId} in ${ctx.chat.id}: ${caption}`);

        const response = await handleMessage(caption, userId, ctx.chat.id, imageUrl);
        await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Photo handler error:", error);
        await ctx.reply("⚠️ Sorry, I couldn't analyze that image.");
    }
});

// ── Handle text messages → agent loop ──────────────────────────────────
bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id;
    const isGroup = ctx.chat.type !== "private";

    // "Respond only when mentioned" logic for groups
    if (isGroup) {
        const botUsername = ctx.me.username;
        const isMentioned = userMessage.includes(`@${botUsername}`) || 
                          (ctx.message.reply_to_message?.from?.id === ctx.me.id);
        
        if (!isMentioned) return;
    }

    const userId = ctx.from!.id;
    console.log(`📩 [Bot] Received text from ${userId} in ${chatId}: "${userMessage.substring(0, 50)}..."`);

    await ctx.replyWithChatAction("typing");
    try {
        const response = await handleMessage(userMessage, userId, chatId);
        await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Agent error:", error);
        await ctx.reply("⚠️ Something went wrong.");
    }
});
