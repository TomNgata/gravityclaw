import "dotenv/config";

export interface MCPServerConfig {
    name: string;
    command: string;
    args: string[];
}

export interface Config {
    telegramBotToken: string;
    anthropicApiKey?: string;
    openRouterApiKey?: string;
    allowedUserIds: number[];
    openaiApiKey: string;
    elevenLabsApiKey: string;
    mcpServers: MCPServerConfig[];
    llmModel: string;
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

export const config: Config = {
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN")!,
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY", false),
    openRouterApiKey: requireEnv("OPENROUTER_API_KEY")!,
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
    mcpServers: process.env.MCP_SERVERS ? JSON.parse(process.env.MCP_SERVERS) : [],
    llmModel: process.env.LLM_MODEL || "claude-3-5-sonnet-20240620",
};
