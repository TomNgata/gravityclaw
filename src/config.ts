import "dotenv/config";

export interface Config {
    telegramBotToken: string;
    anthropicApiKey: string;
    allowedUserIds: number[];
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`❌  Missing required env var: ${name}`);
        console.error(`   Copy .env.example → .env and fill in your values.`);
        process.exit(1);
    }
    return value;
}

export const config: Config = {
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
    allowedUserIds: requireEnv("ALLOWED_USER_IDS")
        .split(",")
        .map((id) => {
            const parsed = parseInt(id.trim(), 10);
            if (isNaN(parsed)) {
                console.error(`❌  Invalid user ID in ALLOWED_USER_IDS: "${id}"`);
                process.exit(1);
            }
            return parsed;
        }),
};
