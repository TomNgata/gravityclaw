import { Bot, Context } from "grammy";
import { config } from "./config.js";
import { handleMessage } from "./agent.js";

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
    await ctx.reply(
        "🦀 *Gravity Claw online.*\n\n" +
        "I'm your personal AI agent. Send me a message and I'll do my best to help.\n\n" +
        "_Powered by Claude — Level 2 (Memory) active._",
        { parse_mode: "Markdown" }
    );
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
