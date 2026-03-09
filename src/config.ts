import "dotenv/config";
import fs from "fs";
import path from "path";

export interface MCPServerConfig {
    name: string;
    command: string;
    args: string[];
}

export interface Config {
    telegramBotToken: string;
    openRouterApiKey: string;
    anthropicApiKey?: string;
    allowedUserIds: number[];
    openaiApiKey: string;
    elevenLabsApiKey: string;
    mcpServers: MCPServerConfig[];
    llmModel: string;
    webhookUrl?: string;
    port: number;
    secretToken: string;
    firecrawlApiKey?: string;
}

function requireEnv(name: string, required: boolean = true): string | undefined {
    const value = process.env[name];
    if (!value && required) {
        const allKeys = Object.keys(process.env).join(", ");
        console.error(`❌  Missing required env var: ${name}`);
        console.error(`   Available keys: ${allKeys.length > 500 ? allKeys.substring(0, 500) + "..." : allKeys}`);
        console.error(`   Copy .env.example → .env and fill in your values.`);
        process.exit(1);
    }
    return value;
}

function loadMcpServers(): MCPServerConfig[] {
    const configPath = path.resolve(process.cwd(), "mcp_servers.json");
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, "utf-8");
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("⚠️ Failed to load mcp_servers.json:", e);
    }
    
    // Fallback to env var if JSON fails or doesn't exist
    return process.env.MCP_SERVERS ? JSON.parse(process.env.MCP_SERVERS) : [];
}

export const config: Config = {
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN")!,
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY")!,
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY", false),
    allowedUserIds: requireEnv("ALLOWED_USER_IDS")!
        .split(",")
        .map((id) => {
            const parsed = parseInt(id.trim(), 10);
            if (isNaN(parsed)) {
                console.error(`❌  Invalid user ID in ALLOWED_USER_IDS: "${id}"`);
                process.exit(1);
            }
            return parsed;
        }),
    openaiApiKey: requireEnv("OPENAI_API_KEY")!,
    elevenLabsApiKey: requireEnv("ELEVENLABS_API_KEY")!,
    mcpServers: loadMcpServers(),
    llmModel: process.env.LLM_MODEL || "google/gemma-3-12b-it:free",
    webhookUrl: process.env.WEBHOOK_URL,
    port: parseInt(process.env.PORT || "3000", 10),
    secretToken: process.env.SECRET_TOKEN || "gravity-claw-secret",
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
};
