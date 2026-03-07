import OpenAI from "openai";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { searchMemories, logConversation, getRecentHistory, searchKnowledgeItems, searchMemoriesSemantic } from "./memory/manager.js";
import { summarizeHistory } from "./memory/summarizer.js";
import { graphManager } from "./memory/graph.js";
import { pruner } from "./memory/pruner.js";
import fs from "fs/promises";
import path from "path";

// ── LLM clients ──────────────────────────────────────────────────────
const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/TomNgata/gravityclaw",
        "X-Title": "Gravity Claw",
    }
});

/**
 * Load personality files dynamically to separate data from logic
 * (Rich Hickey architecture: externalizing state/identity from code)
 */
async function loadPersonality(): Promise<string> {
    try {
        const soul = await fs.readFile(path.resolve(process.cwd(), "soul.md"), "utf-8").catch(() => "");
        const identity = await fs.readFile(path.resolve(process.cwd(), "identity.md"), "utf-8").catch(() => "");
        const personality = await fs.readFile(path.resolve(process.cwd(), "personality.md"), "utf-8").catch(() => "");
        
        const combined = `${soul}\n\n${identity}\n\n${personality}`.trim();
        return combined || "You are Gravity Claw, a sophisticated multi-model agentic swarm.";
    } catch (e) {
        return "You are Gravity Claw, a sophisticated multi-model agentic swarm.";
    }
}

const ORCHESTRATOR_PROMPT = `You are the Gravity Claw Orchestrator. 
Analyze the user's message and history to select the best expert models.

EXPERTS:
1. "qwen/qwen3-coder:free": Best for coding, scripting, and technical architecture.
2. "meta-llama/llama-3.3-70b-instruct:free": Best for complex logic, math, and graduate-level reasoning.
3. "openai/gpt-oss-120b:free": Best for large-scale reasoning and deep knowledge.
4. "stepfun/step-3.5-flash:free": Best for agentic tool use, planning, and fast response.
5. "liquid/lfm-2.5-1.2b-thinking:free": Best for deep thinking and complex multi-step reasoning.
6. "google/gemma-3-12b-it:free": Best for VISION, image analysis, and multi-modal tasks.

CRITICAL INSTRUCTION: Since free endpoints frequently experience rate limits (429) or downtime, you MUST return a JSON array of exactly 3 ranked model strings, from best fit to worst fit. The swarm will fallback through this list.

VISION INSTRUCTION: If an image is provided (indicated below), you MUST put "google/gemma-3-12b-it:free" as the #1 choice.

Return ONLY the valid JSON array (e.g., ["model1", "model2", "model3"]). Do not include markdown blocks or any other text.`;

const MAX_ITERATIONS = 10;

/**
 * The "Orchestrator" Router.
 * Returns an array of ranked models to loop through for fault tolerance.
 */
async function getExpertModels(userMessage: string, history: string, imageUrl?: string): Promise<string[]> {
    try {
        const visionFlag = imageUrl ? "\n[ATTENTION: IMAGE UPLOADED]" : "";
        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: ORCHESTRATOR_PROMPT + `${visionFlag}\n\nUser: ${userMessage}` }],
            max_tokens: 150,
        });
        
        let rawContent = response.choices[0].message.content?.trim() || "";
        rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const models = JSON.parse(rawContent);
        if (Array.isArray(models) && models.length > 0) {
            console.log(`🧠 Orchestrator Ranked:`, models);
            return models;
        }
    } catch (e) {
        console.warn("Router error or invalid JSON, using default fallback queue:", e);
    }
    
    // Default reliable fallback queue
    return [
        "stepfun/step-3.5-flash:free",
        imageUrl ? "google/gemma-3-12b-it:free" : "mistralai/mistral-small-3.1-24b-instruct:free",
        "openai/gpt-oss-20b:free"
    ];
}

/**
 * Main handler for user messages.
 */
export async function handleMessage(
    userMessage: string,
    userId: number,
    imageUrl?: string
): Promise<string> {
    // 1. Context Assembly
    const [memories, knowledgeItems, graphContext, history] = await Promise.all([
        searchMemoriesSemantic(userMessage, 3),
        searchKnowledgeItems(userMessage, 2),
        graphManager.searchGraph(userMessage),
        getRecentHistory(userId, 10)
    ]);
    
    let historyText = history.map(h => `User: ${h.message}\nYou: ${h.response}`).join("\n");

    // 1.1 Context Pruning (Auto-summarize if too long)
    const historyTokens = pruner.estimateTokens(historyText);
    if (historyTokens > 2000) { // Prune if history alone is ~2000 tokens
        console.log(`📉 Context Pruning Triggered: ${historyTokens} tokens`);
        const summary = await pruner.summarizeChunk(userId, history);
        historyText = `--- SUMMARY OF PREVIOUS CONVERSATION ---\n${summary}\n--------------------------------------`;
    }

    // 2. Load dynamic personality
    const basePersonality = await loadPersonality();

    // 3. Orchestration
    console.log(`🔍 [Agent] Orchestrating for user: ${userId}${imageUrl ? " (with image)" : ""}`);
    let expertModels = await getExpertModels(userMessage, historyText, imageUrl);

    // Failsafe guarantees it's an array
    if (!Array.isArray(expertModels) || expertModels.length === 0) {
        expertModels = [
            imageUrl ? "google/gemma-3-12b-it:free" : "stepfun/step-3.5-flash:free",
            "qwen/qwen3-coder:free",
            "meta-llama/llama-3.3-70b-instruct:free"
        ];
    }

    const kiContext = knowledgeItems.length > 0
        ? `\n\nCORE KNOWLEDGE (KIs):\n${knowledgeItems.map(ki => `- [${ki.title}]: ${ki.content}`).join("\n")}`
        : "";

    const memoryContext = memories.length > 0
        ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join("\n")}`
        : "";

    const historyContext = history.length > 0
        ? `\n\nRECENT CONVERSATION:\n${historyText}`
        : "";

    const fullSystemPrompt = `${basePersonality}${kiContext}${memoryContext}${graphContext}${historyContext}\n\nYou are operating within the Gravity Claw framework. You are currently acting as a member of the swarm. Use your specialized strengths to fulfill the user's request.`;

    // Trigger periodic auto-summarization (every 5 messages)
    if (history.length > 0 && history.length % 5 === 0) {
        summarizeHistory(userId).catch(e => console.error("Auto-summarization trigger error:", e));
    }

    // 4. Dispatch with Fallback Loop
    return handleOpenRouterFallback(userMessage, userId, fullSystemPrompt, expertModels, imageUrl);
}

async function handleOpenRouterFallback(
    userMessage: string,
    userId: number,
    systemPrompt: string,
    models: string[],
    imageUrl?: string
): Promise<string> {
    
    // Iterate through the ranked queue of models
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        let model = models[modelIndex];
        console.log(`🚀 [OpenRouter] Attempting dispatch to expert: ${model} (Rank ${modelIndex + 1}/${models.length})`);
        
        // Google Gemma-3 explicitly disallows "system" role messages via OpenRouter free tier
        // Note: The user didn't request Gemma-3 in the latest list, but we keep the logic for safety
        const isGemma = model.includes("gemma");
        const messages: any[] = [];
        
        if (isGemma) {
            messages.push({
                role: "user", content: `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[USER REQUEST]\n` + (imageUrl ? "Please analyze the attached image along with this request: " : "") + userMessage
            });
            if (imageUrl) {
                messages[0].content = [
                    { type: "text", text: (messages[0].content as string) },
                    { type: "image_url", image_url: { url: imageUrl } }
                ];
            }
        } else {
            messages.push({ role: "system", content: systemPrompt });
            messages.push({
                role: "user", content: imageUrl ? [
                    { type: "text", text: userMessage },
                    { type: "image_url", image_url: { url: imageUrl } }
                ] : userMessage
            });
        }

        let finalResponse = "";
        let useTools = !isGemma && toolDefinitions.length > 0;
        let modelSucceeded = false;
        
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            let response;
            try {
                const requestPayload: any = { model: model, messages };
                
                if (useTools) {
                    requestPayload.tools = toolDefinitions.map(t => ({
                        type: "function",
                        function: { name: t.name, description: t.description, parameters: t.input_schema }
                    }));
                }

                response = await openrouter.chat.completions.create(requestPayload);
                const choice = response.choices[0].message;
                modelSucceeded = true; 

                if (!choice.tool_calls || choice.tool_calls.length === 0) {
                    finalResponse = choice.content || "(No response)";
                    break;
                }

                messages.push(choice);

                for (const toolCall of choice.tool_calls) {
                    console.log(`🔧 [OpenRouter:${model}] Tool: ${toolCall.function.name}`);
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        const res = await executeTool(toolCall.function.name, args);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: typeof res === "string" ? res : JSON.stringify(res),
                        });
                    } catch (e) {
                        messages.push({ role: "tool", tool_call_id: toolCall.id, content: `Error: ${e}` });
                    }
                }
                
            } catch (error: any) {
                const isToolOrSystemRejection = error.status === 404 || error.message?.includes("tool") || error.status === 400;
                
                if (isToolOrSystemRejection && useTools) {
                    console.warn(`⚠️ [OpenRouter] Model ${model} crashed on tool calling. Retrying without tools.`);
                    useTools = false; 
                    i--; 
                    continue; 
                }
                
                console.error(`💥 [OpenRouter] Model ${model} failed entirely (Error ${error.status || error.message}). Proceeding to next fallback model...`);
                modelSucceeded = false;
                break; // Break inner loop to trigger fallback to next model in queue
            }
        }
        
        // If the deployment was successful and we got a response, return it (breaking the fallback loop)
        if (modelSucceeded && finalResponse) {
            logConversation(userId, userMessage, finalResponse);
            
            // 🕸️ Update Knowledge Graph (Background)
            graphManager.extractFromText(`${userMessage}\n\n${finalResponse}`).then(({ entities, relationships }) => {
                if (entities.length > 0 || relationships.length > 0) {
                    console.log(`🕸️ Graph Update: ${entities.length} entities, ${relationships.length} relationships`);
                    graphManager.saveGraphData(entities, relationships);
                }
            }).catch(e => console.error("Graph background update error:", e));

            return finalResponse;
        }
    }

    // Exhausted all models
    const fallbackMsg = "⚠️ System Error: All assigned expert models failed in the queue (likely rate limits). Please try again later.";
    logConversation(userId, userMessage, fallbackMsg);
    return fallbackMsg;
}
