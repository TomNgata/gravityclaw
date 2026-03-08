import { bot } from "./bot.js";
import { initializeTools } from "./tools/index.js";
import { startHeartbeat } from "./heartbeat.js";
import { loadSchedules, startProactiveLoops } from "./scheduler/index.js";

const RETRY_DELAY_MS = 15000;
const MAX_RETRIES = 5;

async function start(attempt: number = 1): Promise<void> {
    try {
        console.log(`🦀 Gravity Claw starting... (attempt ${attempt})`);

        await initializeTools();
        startHeartbeat();
        loadSchedules();
        startProactiveLoops();

        await bot.start({
            onStart: (info) => {
                console.log(`🤖 Gravity Claw is online as @${info.username}`);
                console.log(`🚀 Level 8 (Optimized Swarm V3) Active`);
            },
        });
    } catch (error: any) {
        // Handle 409 Conflict: another instance is still running (Railway rolling deploy)
        if (error?.error_code === 409) {
            if (attempt <= MAX_RETRIES) {
                console.warn(`⚠️ 409 Conflict detected. Old instance still running. Retrying in ${RETRY_DELAY_MS / 1000}s... (${attempt}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return start(attempt + 1);
            } else {
                console.error(`❌ Max retries reached. Could not resolve 409 conflict.`);
                process.exit(1);
            }
        }
        console.error("💥 Failed to start Gravity Claw:", error);
        process.exit(1);
    }
}

// Graceful shutdown
const shutdown = () => {
    console.log("🛑 Gravity Claw shutting down...");
    bot.stop();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
