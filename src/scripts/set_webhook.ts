import axios from "axios";
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const hubUrl = process.argv[2] || "https://gravity-claw-hub.tom-ngata.workers.dev";
const secret = process.env.SECRET_TOKEN || "gravity-claw-secret-999";

async function setWebhook() {
    if (!token) {
        console.error("❌ TELEGRAM_BOT_TOKEN not found in .env");
        process.exit(1);
    }

    console.log(`🤖 Setting webhook for bot...`);
    console.log(`🔗 Hub URL: ${hubUrl}`);

    try {
        const url = `https://api.telegram.org/bot${token}/setWebhook`;
        const response = await axios.post(url, {
            url: hubUrl,
            secret_token: secret
        });

        if (response.data.ok) {
            console.log("✅ Webhook set successfully!");
            console.log(response.data.description);
        } else {
            console.error("❌ Failed to set webhook:", response.data);
        }
    } catch (e: any) {
        console.error("❌ Error setting webhook:", e.response?.data || e.message);
    }
}

setWebhook();
