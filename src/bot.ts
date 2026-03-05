import { Bot, Context } from "grammy";
import { config } from "./config.js";
import { handleMessage } from "./agent.js";
import { transcribeAudio } from "./voice/stt.js";
import { synthesizeSpeech } from "./voice/tts.js";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, createWriteStream } from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";
import axios from "axios";

// ── Create bot (long-polling only — no web server) ─────────────────────
export const bot = new Bot(config.telegramBotToken);

// ── Security middleware: user ID whitelist ──────────────────────────────
bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.allowedUserIds.includes(userId)) {
        // Silently ignore non-whitelisted users — no response, no logging of content
        return;
    }
    await next();
});

// ── Handle /start command ──────────────────────────────────────────────
bot.command("start", async (ctx) => {
    const welcome = `🤖 **Gravity Claw Online**
Version: Level 7 (Optimized Swarm V2)

I am now a multi-model agentic swarm, dynamically routing your requests to specialized experts:
- 🧠 **Strategy/Logic**: GPT-OSS 120B (Free)
- 💻 **Engineering**: Qwen3 Coder 480B (Free)
- 🔧 **Agentic/Tools**: GLM 4.5 Air (Free)
- 👁️ **Vision/Chat**: Gemma 3 12B (Free)
- ⚡ **Router**: StepFun 3.5 Flash (Free)

How can I help you today?`;
    await ctx.reply(welcome, { parse_mode: "Markdown" });
});

// ── Handle Voice Messages ──────────────────────────────────────────────
bot.on("message:voice", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.replyWithChatAction("record_voice");

    try {
        // 1. Get file path from Telegram
        const file = await ctx.getFile();
        const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;

        const tempDir = join(process.cwd(), "temp");
        if (!existsSync(tempDir)) mkdirSync(tempDir);
        const filePath = join(tempDir, `${file.file_id}.ogg`);

        // 2. Download via axios
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = createWriteStream(filePath);
        response.data.pipe(writer);
        await finished(writer);

        // 3. Transcribe
        const transcribedText = await transcribeAudio(filePath);
        console.log(`🎤 Voice from ${userId}: ${transcribedText}`);

        // 4. Process with Agent
        const agentResponse = await handleMessage(transcribedText, userId);

        // 5. Respond
        await ctx.reply(agentResponse, { parse_mode: "Markdown" });

        // Clean up
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
        // 1. Get the highest resolution photo
        const photo = ctx.message.photo.pop()!;
        const file = await ctx.getFile();
        const imageUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;

        const caption = ctx.message.caption || "What is in this image?";
        console.log(`📸 Photo from ${userId}: ${caption}`);

        // 2. Process with Agent (passing the image URL)
        const response = await handleMessage(caption, userId, imageUrl);

        // 3. Respond
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

    // Show "typing…" indicator while processing
    await ctx.replyWithChatAction("typing");

    try {
        const userId = ctx.from!.id;
        const response = await handleMessage(userMessage, userId);
        await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Agent error:", error);
        await ctx.reply("⚠️ Something went wrong. Check the console for details.");
    }
});
