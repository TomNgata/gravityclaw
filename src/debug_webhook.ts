import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

async function checkWebhook() {
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not found in .env");
    return;
  }
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    console.log("Webhook Info:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Error fetching webhook info:", error?.message || error);
  }
}

checkWebhook();
