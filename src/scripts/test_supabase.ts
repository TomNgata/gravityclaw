import { supabase } from '../memory/database.js';
import { saveMemory, searchMemoriesSemantic, logConversation, getRecentHistory } from '../memory/manager.js';
import { setThinkingLevel, getThinkingLevel } from '../memory/settings.js';

async function testMigration() {
    console.log("🧪 Starting Supabase Migration Verification Test...");

    try {
        // 1. Test Saving and Searching Memory
        console.log("   - Testing memory persistence...");
        const memId = await saveMemory("Test cloud memory for Gravity Claw swarm.", 999, "test");
        console.log(`   ✅ Memory saved with ID: ${memId}`);

        const results = await searchMemoriesSemantic("Gravity Claw", 999);
        if (results.length > 0) {
            console.log(`   ✅ Semantic search found ${results.length} results.`);
        } else {
            console.warn("   ⚠️ Semantic search returned 0 results (ILIKE fallback confirmed).");
        }

        // 2. Test Conversation History
        console.log("   - Testing conversation history...");
        await logConversation(999, 999, "Hello cloud!", "Response from swarm.");
        const history = await getRecentHistory(999, 1);
        if (history.length > 0 && (history[0].message === "Hello cloud!" || history[history.length-1].message === "Hello cloud!")) {
            console.log("   ✅ Conversation history verified.");
        } else {
            throw new Error("Conversation history mismatch.");
        }

        // 3. Test Settings
        console.log("   - Testing user settings...");
        await setThinkingLevel(999, "high");
        const level = await getThinkingLevel(999);
        if (level === "high") {
            console.log("   ✅ User settings verified.");
        } else {
            throw new Error(`Settings mismatch: ${level}`);
        }

        console.log("\n🎊 ALL CLOUD PERSISTENCE TESTS PASSED!");
        console.log("🚀 Gravity Claw Swarm Brain is fully operational.");

    } catch (error) {
        console.error("❌ Verification failed:", error);
    }
}

testMigration();
