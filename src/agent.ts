import OpenAI from "openai";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { searchMemories, logConversation, getRecentHistory } from "./memory/manager.js";

// ── LLM clients ──────────────────────────────────────────────────────
const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/TomNgata/gravityclaw",
        "X-Title": "Gravity Claw",
    }
});

const SYSTEM_PROMPT = `You are Gravity Claw, a sophisticated multi-model agentic swarm. 
Current Version: Level 7 (Optimized Swarm V2).

ORCHESTRATION ARCHITECTURE:
- **Router**: StepFun 3.5 Flash (Fast/Broad Context).
- **Expert (Code)**: Qwen3 Coder 480B (Top-tier engineering).
- **Expert (Agentic/Tools)**: GLM 4.5 Air (Logic-first tool orchestration).
- **Expert (Reasoning)**: GPT-OSS 120B (High-IQ logic).
- **Expert (Vision/Chat)**: Gemma 3 12B (General chat).

SUPERPOWERS:
- SQLite/FTS5 Memory.
- Voice (STT/TTS) & Vision.
- System Access (Shell/FS).
- MCP Bridge (External Tools).

You are currently acting as one of these experts. Use your specialized strengths to fulfill the user's request.
`;

const MAX_ITERATIONS = 10;

/**
 * The "Orchestrator" Router.
 * Uses a fast model (StepFun) to decide which expert brain is best for the task.
 */
async function getExpertModel(userMessage: string, history: string): Promise<string> {
    const routerPrompt = `You are the Gravity Claw Orchestrator. 
Analyze the user's message and history to select the best expert model.

EXPERTS:
1. "qwen/qwen-3-480b-coder-it:free" -> STRICTLY ALWAYS pick this if the request involves coding, scripting, scraping, languages like Python/JS, or terminal commands.
2. "z-ai/glm-4.5-air:free" -> Best for multi-step planning, tool use, memory recall, and system tasks.
3. "openai/gpt-oss-120b:free" -> Best for complex logic, math, riddles, and graduate-level reasoning.
4. "google/gemma-3-12b-it:free" -> ONLY use for simple short conversational replies or greetings. NEVER use for coding or scripting.

CRITICAL INSTRUCTION: If the user says "scrape a website", "write python", "debug", or mentions any programming task, you MUST select qwen-3-480b-coder.

RULES:
- Return ONLY the exact model string (e.g. "qwen/qwen-3-480b-coder-it:free"). Do not include any other text.`;

    try {
        const response = await openrouter.chat.completions.create({
            model: "stepfun/step-3.5-flash:free",
            messages: [{ role: "user", content: routerPrompt }],
            max_tokens: 50,
        });
        const rawContent = response.choices[0].message.content?.trim() || "google/gemma-3-12b-it:free";
        const selection = rawContent.replace(/^["']|["']$/g, ''); // Strip quotes
        console.log(`🧠 Orchestrator: Directed to ${selection}`);
        return selection;
    } catch (e) {
        console.error("Router error, using default free model:", e);
        return "qwen/qwen-3-480b-coder-it:free";
    }
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
    const memories = searchMemories(userMessage, 3);
    const history = getRecentHistory(userId, 10);
    const historyText = history.map(h => `User: ${h.message}\nYou: ${h.response}`).join("\n");

    // 2. Orchestration
    console.log(`🔍 [Agent] Orchestrating for user: ${userId}`);
    let expertModel = await getExpertModel(userMessage, historyText);

    // Failsafe for incorrect orchestration output
    if (!expertModel.includes("/") || expertModel.includes(" ")) {
        expertModel = "qwen/qwen-3-480b-coder-it:free";
    }

    const memoryContext = memories.length > 0
        ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join("\n")}`
        : "";

    const historyContext = history.length > 0
        ? `\n\nRECENT CONVERSATION:\n${historyText}`
        : "";

    const fullSystemPrompt = `${SYSTEM_PROMPT}${memoryContext}${historyContext}\n\nYou are currently operating as the ${expertModel} expert.`;

    // 3. Dispatch
    return handleOpenRouter(userMessage, userId, fullSystemPrompt, expertModel, imageUrl);
}

async function handleOpenRouter(
    userMessage: string,
    userId: number,
    systemPrompt: string,
    model: string,
    imageUrl?: string
): Promise<string> {
    
    // Google Gemma-3 explicitly disallows "system" role messages via OpenRouter free tier ("Developer instruction is not enabled")
    const isGemma = model.includes("gemma");
    
    const messages: any[] = [];
    
    if (isGemma) {
        // Embed system prompt inside the first user message for Gemma
        messages.push({
            role: "user", content: `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[USER REQUEST]\n` + (imageUrl ? "Please analyze the attached image along with this request: " : "") + userMessage
        });
        if (imageUrl) {
            messages[0].content = [
                { type: "text", text: messages[0].content },
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

    console.log(`🚀 [OpenRouter] Dispatching to expert: ${model}`);
    let finalResponse = "";
    
    // Gemma free endpoints generally do not support tools on OpenRouter right now
    let useTools = !isGemma && toolDefinitions.length > 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        let response;
        try {
            const requestPayload: any = {
                model: model,
                messages,
            };
            
            if (useTools) {
                requestPayload.tools = toolDefinitions.map(t => ({
                    type: "function",
                    function: { name: t.name, description: t.description, parameters: t.input_schema }
                }));
            }

            response = await openrouter.chat.completions.create(requestPayload);
            
        } catch (error: any) {
            // Handle Rate Limit globally (OpenRouter frequently rate-limits the free Gemma endpoints)
            if (error.status === 429) {
                console.warn(`⚠️ [OpenRouter] Model ${model} is rate-limited (429). Failing over to qwen-coder.`);
                model = "qwen/qwen-3-480b-coder-it:free";
                useTools = false; // Drop tools to be safe on failover
                i--; // Retry
                continue;
            }
            
            // Handle Tool/SystemPrompt rejections
            if (error.status === 404 || error.message?.includes("tool") || error.status === 400) {
                console.warn(`⚠️ [OpenRouter] Model ${model} crashed. Falling back to simple chat text routing.`);
                if (useTools) {
                    useTools = false; // Disable tools
                    i--; // Retry this iteration without tools
                    continue;
                }
            }
            
            console.error(`💥 [OpenRouter] Critical API Error:`, error);
            return `System Error: The assigned expert model (${model}) failed. Please try again.`;
        }

        const choice = response.choices[0].message;

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
    }

    logConversation(userId, userMessage, finalResponse || "⚠️ Max iterations reached.");
    return finalResponse || "⚠️ Max iterations reached.";
}
