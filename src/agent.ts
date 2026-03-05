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

const SYSTEM_PROMPT = `You are Gravity Claw, a powerful agentic AI. 
Current Version: Level 5 (MCP Core).

SUPERPOWERS:
- You have access to a SQLite/FTS5 memory system to remember facts and history.
- You can hear voice messages, speak back (TTS), and see images (Vision).
- You have SHELL access and FILE SYSTEM access. You can run commands (git, npm, ls) and read/write files.
- **MCP BRIDGE**: You can connect to external servers to expand your tools.

SAFETY RULES:
- Never delete essential project files without confirmation.
- Keep security (ALLOWED_USER_IDS) as a top priority.
- Be proactive but careful with shell commands.
`;

const MAX_ITERATIONS = 10;

/**
 * Main handler for user messages.
 * Switches between Anthropic and OpenRouter based on configuration.
 */
export async function handleMessage(
    userMessage: string,
    userId: number,
    imageUrl?: string
): Promise<string> {
    // 1. Memory & History
    const memories = searchMemories(userMessage, 3);
    const memoryContext = memories.length > 0
        ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join("\n")}`
        : "";

    const history = getRecentHistory(userId, 10);
    const historyContext = history.length > 0
        ? `\n\nRECENT CONVERSATION:\n${history.map(h => `User: ${h.message}\nYou: ${h.response}`).join("\n")}`
        : "";

    const fullSystemPrompt = `${SYSTEM_PROMPT}${memoryContext}${historyContext}`;

    // 2. Decide provider
    if (openrouter) {
        return handleOpenRouter(userMessage, userId, fullSystemPrompt, imageUrl);
    } else if (anthropic) {
        return handleAnthropic(userMessage, userId, fullSystemPrompt, imageUrl);
    } else {
        throw new Error("No LLM provider configured (Anthropic or OpenRouter).");
    }
}

async function handleAnthropic(
    userMessage: string,
    userId: number,
    systemPrompt: string,
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
            model: config.llmModel,
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
            console.log(`🔧 [Anthropic] Tool: ${tool.name}`);
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
            model: config.llmModel,
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
            console.log(`🔧 [OpenRouter] Tool: ${toolCall.function.name}`);
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
