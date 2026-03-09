/**
 * Gravity Claw: The Immortal Hub (Cloudflare Worker)
 * 
 * This worker acts as the entry point for Telegram Webhooks.
 * It handles lightweight tasks natively and dispatches complex work to Tier 2 workers.
 */

export interface Env {
    // List of Tier 2 Worker URLs (e.g., Render, Koyeb)
    WORKER_NODES: string; // Comma-separated or JSON array
    TELEGRAM_BOT_TOKEN: string;
    SECRET_TOKEN: string; // For validating Telegram webhook integrity
}

export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Request | Response> {
        if (request.method !== "POST") {
            return new Response("Gravity Claw Hub Online.", { status: 200 });
        }

        // 1. Validate the secret token from Telegram
        const telegramSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (telegramSecret !== env.SECRET_TOKEN) {
            return new Response("Unauthorized", { status: 403 });
        }

        try {
            const update = await request.json();

            // 2. Handle Lightweight Native Tasks (Active Hub)
            if (update.message?.text) {
                const text = update.message.text;
                const chatId = update.message.chat.id;

                if (text === "/start" || text === "/status") {
                    await this.sendTelegramResponse(chatId, "🛡️ **Gravity Claw Immortal Hub** is active.\n\n`Status:` Monitoring Swarm...\n`Tier 2 Nodes:` Active", env);
                    return new Response("OK", { status: 200 });
                }
            }

            // 3. Dispatch to Tier 2 (The Swarm)
            // We fire-and-forget to Tier 2 to ensure Telegram gets a 200 OK immediately
            ctx.waitUntil(this.dispatchToSwarm(update, env));

            return new Response("OK", { status: 200 });
        } catch (err) {
            console.error("Hub Error:", err);
            return new Response("Error", { status: 500 });
        }
    },

    async dispatchToSwarm(update: any, env: Env) {
        const nodes = env.WORKER_NODES.split(",").map(n => n.trim());
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        
        // Try to find an active node (simple failover)
        for (const node of nodes) {
            try {
                const response = await fetch(node, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-Telegram-Bot-Api-Secret-Token": env.SECRET_TOKEN
                    },
                    body: JSON.stringify(update)
                });

                if (response.ok) {
                    console.log(`Successfully dispatched to node: ${node}`);
                    return; // Task handled
                } else if (response.status === 403) {
                    console.error(`Node ${node} rejected request (403). Secret mismatch?`);
                }
            } catch (e) {
                console.warn(`Node ${node} failed or is sleeping. Trying next...`);
            }
        }
        
        console.error("All Tier 2 nodes failed to respond.");
        if (chatId) {
            await this.sendTelegramResponse(chatId, "⚠️ **Swarm Connectivity Error**: I couldn't reach any processing nodes. Please ensure your Tier 2 secrets (Telegram Token & Secret Token) are updated in Railway/Render.", env);
        }
    },

    async sendTelegramResponse(chatId: number, text: string, env: Env) {
        const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "Markdown"
            })
        });
    }
};
