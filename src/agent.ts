import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { searchMemories, logConversation, getRecentHistory } from "./memory/manager.js";
import axios from "axios";

// ── LLM clients ──────────────────────────────────────────────────────
const anthropic = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;
const openrouter = config.openRouterApiKey ? new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/TomNgata/gravityclaw",
        "X-Title": "Gravity Claw",
    }
}) : null;

const SYSTEM_PROMPT = `You are Gravity Claw, a multi-model agentic swarm. 
Current Version: Level 6 (Multi-Model Orchestration).

ORCHESTRATION ARCHITECTURE:
- **Router**: Gemini 2.0 Flash Lite (Free/Fast).
- **Expert (Code)**: Qwen 2.5 Coder (Specifically tuned for software).
- **Expert (Reasoning)**: Llama 3.3 70B (High-IQ free reasoning).
- **Expert (Speed/Vision)**: Gemini 2.0 Flash Lite.

SUPERPOWERS:
- SQLite/FTS5 Memory.
- Voice (STT/TTS) & Vision (Claude/Gemini).
- System Access (Shell/FS).
- MCP Bridge (External Tools).

You are currently acting as one of these experts. Use your specialized strengths to fulfill the user's request.
`;

const MAX_ITERATIONS = 10;

/**
 * The "Orchestrator" Router.
 * Uses a fast model (Gemini) to decide which expert brain is best for the task.
 */
async function getExpertModel(userMessage: string, history: string): Promise<string> {
    if (!openrouter) return config.llmModel;

    const routerPrompt = `You are the Gravity Claw Orchestrator. 
Analyze the user's message and history to select the best expert model.

EXPERTS:
1. "qwen/qwen-2.5-coder-32b-instruct:free": Best for coding, scripting, and technical architecture.
2. "meta-llama/llama-3.3-70b-instruct:free": Best for complex logic, reasoning, and planning.
3. "google/gemini-2.0-flash-lite-preview-02-05:free": Best for fast chat, vision (images), and real-time response.
4. "arcee/trinity-large-preview:free": Best for creative writing, prompt generation, and roleplay.

RULES:
- Return ONLY the model string.
- Use "arcee/trinity-large-preview:free" if the user wants creative writing or prompt help.
- Use "qwen/qwen-2.5-coder-32b-instruct:free" for ANY code-related request.
- Default to "google/gemini-2.0-flash-lite-preview-02-05:free".`;

    try {
        const response = await openrouter.chat.completions.create({
            model: "google/gemini-2.0-flash-lite-preview-02-05:free",
            messages: [{ role: "user", content: routerPrompt }],
            max_tokens: 50,
        });
        const selection = response.choices[0].message.content?.trim();
        console.log(`🧠 Orchestrator: Directed to ${selection}`);
        return selection || "google/gemini-2.0-flash-lite-preview-02-05:free";
    } catch (e) {
        console.error("Router error, using default free model:", e);
        return "google/gemini-2.0-flash-lite-preview-02-05:free";
    }
}

/**
 * Main handler for user messages.
 * Switches between Anthropic and OpenRouter based on configuration.
 */
export async function handleMessage(
    userMessage: string,
    userId: number,
    imageUrl?: string
): Promise<string> {
    const memories = searchMemories(userMessage, 3);
    const history = getRecentHistory(userId, 5);

    const historyText = history.map(h => `User: ${h.message}\nClaw: ${h.response}`).join("\n");
    const expertModel = await getExpertModel(userMessage, historyText);

    const memoryContext = memories.length > 0
        ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join("\n")}`
        : "";

    const fullSystemPrompt = `${SYSTEM_PROMPT}${memoryContext}\n\nRECENT CONVERSATION:\n${historyText}`;

    // Decide provider path
    if (openrouter) {
        return handleOpenRouter(userMessage, userId, fullSystemPrompt, expertModel, imageUrl);
    } else if (anthropic) {
        return handleAnthropic(userMessage, userId, fullSystemPrompt, expertModel, imageUrl);
    } else {
        throw new Error("No LLM provider configured.");
    }
}

async function handleAnthropic(
    userMessage: string,
    userId: number,
    systemPrompt: string,
    model: string,
    imageUrl?: string
): Promise<string> {
    const userContent: Anthropic.MessageParam["content"] = [];

    if (imageUrl) {
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            userContent.push({
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: base64 },
            } as any);
        } catch (error) {
            console.error("Vision error:", error);
        }
    }

    userContent.push({ type: "text", text: userMessage });

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];
    let finalResponse = "";

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await anthropic!.messages.create({
            model: model.includes("claude") ? model : "claude-3-5-sonnet-20240620",
            max_tokens: 1024,
            system: systemPrompt,
            tools: toolDefinitions,
            messages,
        });

        const toolUses = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
        const text = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("\n");

        if (toolUses.length === 0) {
            finalResponse = text || "(No response)";
            break;
        }

        messages.push({ role: "assistant", content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];

        for (const tool of toolUses) {
            console.log(`🔧 [Anthropic:${model}] Tool: ${tool.name}`);
            try {
                const res = await executeTool(tool.name, tool.input as any);
                results.push({
                    type: "tool_result",
                    tool_use_id: tool.id,
                    content: typeof res === "string" ? res : JSON.stringify(res),
                });
            } catch (e) {
                results.push({ type: "tool_result", tool_use_id: tool.id, content: `Error: ${e}`, is_error: true });
            }
        }
        messages.push({ role: "user", content: results });
    }

    logConversation(userId, userMessage, finalResponse || "⚠️ Max iterations reached.");
    return finalResponse || "⚠️ Max iterations reached.";
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

    let finalResponse = "";

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await openrouter!.chat.completions.create({
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
