import { bot } from "./bot.js";
import { initializeTools } from "./tools/index.js";

async function main() {
    try {
        console.log("🦀 Gravity Claw starting...");

        await initializeTools();

        bot.start({
            onStart: (info) => {
                console.log(`🤖 Gravity Claw is online as @${info.username}`);
                console.log(`🚀 Level 7 (Optimized Swarm V2) Active`);
            },
        });
    } catch (error) {
        console.error("💥 Failed to start Gravity Claw:", error);
        process.exit(1);
    }
}

const shutdown = () => {
    console.log("🛑 Gravity Claw shutting down...");
    bot.stop();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
