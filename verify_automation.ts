import { parseNaturalLanguageToCron } from "./src/scheduler/parser.js";
import { getSkillsContext } from "./src/skills/loader.js";

async function runVerification() {
    console.log("🧪 Starting Automation & Skills Verification...\n");

    try {
        console.log("--- Testing Skills System ---");
        const skillsContext = await getSkillsContext();
        if (skillsContext && skillsContext.includes("Code Reviewer Skill")) {
            console.log("✅ Skills loaded successfully.");
            console.log(`Preview:\n${skillsContext.substring(0, 100)}...\n`);
        } else {
            console.error("❌ Failed to load skills context properly.");
        }

        console.log("--- Testing Scheduler NLP Parsing ---");
        // Test parsing "every day at 9am" -> 0 9 * * *
        const nlTest = "every day at 9am";
        const cronResult = await parseNaturalLanguageToCron(nlTest);
        if (cronResult && cronResult.split(" ").length === 5) {
            console.log(`✅ Parsed NLP '${nlTest}' -> '${cronResult}' (Looking for something like '0 9 * * *')`);
        } else {
            console.error(`❌ Failed to parse NLP correctly. Got: ${cronResult}`);
        }

        console.log("\n✨ Verification Complete.");
    } catch (e) {
        console.error("❌ Verification failed heavily:", e);
    }
}

runVerification().catch(console.error);
