import { sendMorningBriefing } from "./src/proactive/briefing.js";
import { sendEveningRecap } from "./src/proactive/recap.js";
import { getRecommendationContext } from "./src/proactive/recommendations.js";
import { config } from "./src/config.js";

async function verifyProactiveFeatures() {
    console.log("🧪 Starting Proactive Systems Verification...\n");

    if (config.allowedUserIds.length === 0) {
        console.error("❌ No allowedUserIds configured in .env. Add one to test telegram dispatch.");
        process.exit(1);
    }

    const testUser = config.allowedUserIds[0];

    try {
        console.log("--- Testing Recommendations Pattern Analyzer ---");
        const ctx = getRecommendationContext(testUser);
        console.log(`✅ Recommendations Context:\n${ctx}\n`);

        console.log("--- Testing Morning Briefing System ---");
        // We call the compilation directly. It should fire the LLM handleMessage and then Telegram dispatch.
        // It's expected to succeed if API keys are valid.
        await sendMorningBriefing(testUser);
        
        console.log("\n--- Testing Evening Recap System ---");
        await sendEveningRecap(testUser);

        console.log("\n✨ Verification Complete.");
        process.exit(0);
    } catch (e) {
        console.error("\n❌ Verification Failed:", e);
        process.exit(1);
    }
}

verifyProactiveFeatures();
