import OpenAI from "openai";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { searchMemories, logConversation, getRecentHistory } from "./memory/manager.js";
import axios from "axios";

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
- **Expert (Vision)**: Gemma 3 12B (Multimodal vision).

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
1. "qwen/qwen-3-480b-coder-it:free": Best for coding, scripting, and technical architecture.
2. "z-ai/glm-4.5-air:free": Best for multi-step planning, tool use, and system tasks.
3. "openai/gpt-oss-120b:free": Best for complex logic, math, and graduate-level reasoning.
4. "google/gemma-3-12b-it:free": Best for vision, image analysis, and fast chat.

RULES:
- Return ONLY the model string.
- Default to "google/gemma-3-12b-it:free" for general chat.
- Always pick "qwen/qwen-3-480b-coder-it:free" for software work.`;

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
        return "google/gemma-3-12b-it:free";
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
    const expertModel = await getExpertModel(userMessage, historyText);

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
    const messages: any[] = [
        { role: "system", content: systemPrompt },
        {
            role: "user", content: imageUrl ? [
                { type: "text", text: userMessage },
                { type: "image_url", image_url: { url: imageUrl } }
            ] : userMessage
        }
    ];

    console.log(`🚀 [OpenRouter] Dispatching to expert: ${model}`);
    let finalResponse = "";

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await openrouter.chat.completions.create({
            model: model,
            messages,
            tools: toolDefinitions.map(t => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.input_schema }
            })) as any,
        });

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
