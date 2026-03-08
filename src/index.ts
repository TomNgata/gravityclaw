import { bot } from "./bot.js";
import { initializeTools } from "./tools/index.js";
import { loadSkills } from "./skills/loader.js";
import { startHeartbeat } from "./heartbeat.js";
import { loadSchedules, startProactiveLoops } from "./scheduler/index.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { handleUpdate } from "./bot.js";
import { config } from "./config.js";

const RETRY_DELAY_MS = 15000;
const MAX_RETRIES = 5;
const startTime = new Date();

/**
 * Unified HTTP handler:
 * - GET /health or /ping → UptimeRobot keepalive (always 200 OK)
 * - POST /<secret>       → Telegram webhook update
 */
function createHttpServer() {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = req.url || "/";

        // ── Health / Ping endpoint ────────────────────────────────────
        if (req.method === "GET" && (url === "/health" || url === "/ping")) {
            const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                service: "gravity-claw",
                uptime_seconds: uptime,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // ── Telegram Webhook ──────────────────────────────────────────
        return handleUpdate(req, res);
    });
}

async function start(attempt: number = 1): Promise<void> {
    try {
        console.log(`🦀 Gravity Claw starting... (attempt ${attempt})`);

        await loadSkills();
        await initializeTools();
        startHeartbeat();
        loadSchedules();
        startProactiveLoops();

        if (process.env.USE_WEBHOOK === "true") {
            const server = createHttpServer();
            server.listen(config.port, () => {
                console.log(`🚀 Gravity Claw Webhook Server running on port ${config.port}`);
                console.log(`💓 Health endpoint live at: /health`);
            });
        } else {
            await bot.start({
                onStart: (info) => {
                    console.log(`🤖 Gravity Claw is online as @${info.username} (Long Polling)`);
                    console.log(`🚀 Level 8 (Optimized Swarm V3) Active`);
                },
            });
        }
    } catch (error: any) {
        if (error?.error_code === 409) {
            if (attempt <= MAX_RETRIES) {
                console.warn(`⚠️ 409 Conflict detected. Retrying in ${RETRY_DELAY_MS / 1000}s... (${attempt}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return start(attempt + 1);
            } else {
                console.error(`❌ Max retries reached.`);
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
