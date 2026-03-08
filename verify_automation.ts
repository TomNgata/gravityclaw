import { loadSkills, getSkillsContext } from "./src/skills/loader.js";
import { initializeTools, toolDefinitions } from "./src/tools/index.js";

async function runVerification() {
    console.log("🧪 Starting Automation & Skills Verification...\n");

    try {
        console.log("--- Testing Skills System ---");
        await loadSkills();
        const skillsContext = getSkillsContext();
        if (skillsContext && skillsContext.includes("Expert Logical Reasoning")) {
            console.log("✅ Skills loaded and cached successfully.");
            console.log(`Preview:\n${skillsContext.substring(0, 150)}...\n`);
        } else {
            console.error("❌ Failed to load skills context properly.");
        }

        console.log("--- Testing MCP Bridge ---");
        await initializeTools();
        const mcpTools = toolDefinitions.filter(t => t.name.includes("__"));
        if (mcpTools.length > 0) {
            console.log(`✅ MCP Tools loaded: ${mcpTools.length}`);
            console.log(`Sample: ${mcpTools[0].name}`);
        } else {
            console.warn("⚠️ No MCP tools found (is the fetch server running?).");
        }

        console.log("\n✨ Verification Complete.");
    } catch (e) {
        console.error("❌ Verification failed heavily:", e);
    }
}

runVerification().catch(console.error);
