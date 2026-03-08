import { Bot, Context } from "grammy";
import { config } from "./config.js";
import { handleMessage } from "./agent.js";
import { transcribeAudio } from "./voice/stt.js";
import { synthesizeSpeech } from "./voice/tts.js";
import { join } from "path";
import { existsSync, mkdirSync, unlinkSync, createWriteStream } from "fs";
import { finished } from "stream/promises";
import axios from "axios";

import { pruner } from "./memory/pruner.js";
import { getThinkingLevel, setThinkingLevel, ThinkingLevel } from "./memory/settings.js";
import { addSchedule, getTasks, pauseSchedule, resumeSchedule, deleteSchedule } from "./scheduler/index.js";

// ── Create bot (long-polling only — no web server) ─────────────────────
export const bot = new Bot(config.telegramBotToken);

// ── Security middleware: user ID whitelist ──────────────────────────────
bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.allowedUserIds.includes(userId)) {
        console.warn(`🔒 Access Denied for User ID: ${userId}`);
        return;
    }
    await next();
});

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
    if (!userId) return;

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
    if (!userId) return;

    const args = ctx.match.trim().toLowerCase();
    const validLevels = ["off", "low", "medium", "high"];

    if (!args || !validLevels.includes(args)) {
        const currentLevel = getThinkingLevel(userId);
        await ctx.reply(
            `🧠 *Thinking Level Configuration*\n\nCurrent Level: \`${currentLevel}\`\n\nUsage: \`/think [off|low|medium|high]\`\n- \`off\`: Default fast responses.\n- \`low\`: Brief step-by-step reasoning.\n- \`medium\`: Detailed step-by-step reasoning.\n- \`high\`: Exhaustive, multi-angle reasoning.`,
            { parse_mode: "Markdown" }
        );
        return;
    }

    try {
        setThinkingLevel(userId, args as ThinkingLevel);
        await ctx.reply(`✅ *Thinking Level set to:* \`${args}\``, { parse_mode: "Markdown" });
    } catch (e) {
        console.error("Thinking level error:", e);
        await ctx.reply("⚠️ Failed to update thinking level.");
    }
});

// ── Handle /schedule commands ──────────────────────────────────────────
bot.command("schedule", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

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

    const tasks = getTasks(userId);
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
    const taskId = parseInt(ctx.match.trim());
    if (!userId || isNaN(taskId)) return;

    const success = pauseSchedule(userId, taskId);
    await ctx.reply(success ? `⏸️ Task ${taskId} paused.` : `⚠️ Task ${taskId} not found.`);
});

bot.command("resume_task", async (ctx) => {
    const userId = ctx.from?.id;
    const taskId = parseInt(ctx.match.trim());
    if (!userId || isNaN(taskId)) return;

    const success = resumeSchedule(userId, taskId);
    await ctx.reply(success ? `▶️ Task ${taskId} resumed.` : `⚠️ Task ${taskId} not found.`);
});

bot.command("delete_task", async (ctx) => {
    const userId = ctx.from?.id;
    const taskId = parseInt(ctx.match.trim());
    if (!userId || isNaN(taskId)) return;

    const success = deleteSchedule(userId, taskId);
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
        console.log(`🎤 Voice from ${userId}: ${transcribedText}`);

        console.log(`🔍 [Agent] Orchestrating for user: ${userId}`);
        const agentResponse = await handleMessage(transcribedText, userId);
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
        console.log(`📸 Photo from ${userId}: ${caption}`);

        console.log(`🔍 [Agent] Orchestrating for user: ${userId}`);
        const response = await handleMessage(caption, userId, imageUrl);
        await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Photo handler error:", error);
        await ctx.reply("⚠️ Sorry, I couldn't analyze that image.");
    }
});

// ── Handle text messages → agent loop ──────────────────────────────────
bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    if (!userMessage) return;

    const userId = ctx.from!.id;
    console.log(`📩 [Bot] Received text from ${userId}: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

    // Show "typing…" indicator while processing
    await ctx.replyWithChatAction("typing");
    try {
        console.log(`🔍 [Agent] Orchestrating for user: ${userId}`);
        const response = await handleMessage(userMessage, userId);
        await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Agent error:", error);
        await ctx.reply("⚠️ Something went wrong. Check the console for details.");
    }
});
