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
