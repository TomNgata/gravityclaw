import { bot } from "./bot.js";
import { config } from "./config.js";

// ── Startup ────────────────────────────────────────────────────────────
console.log("🦀 Gravity Claw starting...");
console.log(`   Allowed users: ${config.allowedUserIds.join(", ")}`);
console.log(`   Mode: long-polling (no web server)`);

// Graceful shutdown
const shutdown = () => {
    console.log("\n🦀 Gravity Claw shutting down...");
    bot.stop();
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the bot (long-polling — no HTTP, no exposed ports)
bot.start({
    onStart: () => {
        console.log("🦀 Gravity Claw online. Waiting for messages...");
    },
});
