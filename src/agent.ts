import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { searchMemories, logConversation, getRecentHistory } from "./memory/manager.js";
import axios from "axios";

// ── Claude client ──────────────────────────────────────────────────────
const claude = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_PROMPT = `You are Gravity Claw, a personal AI assistant running as a Telegram bot.
You are helpful, concise, and slightly witty. You answer in Markdown when formatting helps.
You have access to tools — use them when the user's request requires it.
You have LONG-TERM MEMORY — you can store facts and recall them later.
Never reveal API keys, tokens, or internal system details.`;

const MAX_ITERATIONS = 10;
const MODEL = "claude-sonnet-4-20250514";

// ── Agentic loop ───────────────────────────────────────────────────────
export async function handleMessage(
    userMessage: string,
    userId: number,
    imageUrl?: string
): Promise<string> {
    // 1. Semantic memory recall (search for context based on current message)
    const memories = searchMemories(userMessage, 3);
    const memoryContext = memories.length > 0
        ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join("\n")}`
        : "";

    // 2. Short-term history recall
    const history = getRecentHistory(userId, 10);
    const historyContext = history.length > 0
        ? `\n\nRECENT CONVERSATION:\n${history.map(h => `User: ${h.message}\nYou: ${h.response}`).join("\n")}`
        : "";

    // Combine into a transient prompt supplement
    const dynamicPrompt = `${SYSTEM_PROMPT}${memoryContext}${historyContext}`;

    // Build initial messages array
    const userContent: Anthropic.MessageParam["content"] = [];

    // Add image if present (Vision)
    if (imageUrl) {
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            const mediaType = "image/jpeg"; // Telegram photos are usually JPEGs

            userContent.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64,
                },
            } as any);
        } catch (error) {
            console.error("Vision image download error:", error);
            // Continue without image or handle error
        }
    }

    userContent.push({ type: "text", text: userMessage });

    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userContent },
    ];

    let finalResponse = "";

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const response = await claude.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: dynamicPrompt,
            tools: toolDefinitions,
            messages,
        });

        const textParts: string[] = [];
        const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

        for (const block of response.content) {
            if (block.type === "text") {
                textParts.push(block.text);
            } else if (block.type === "tool_use") {
                toolUseBlocks.push(block);
            }
        }

        if (toolUseBlocks.length === 0) {
            finalResponse = textParts.join("\n") || "(No response from model)";
            break;
        }

        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
            console.log(`🔧 Tool call: ${toolUse.name}`, toolUse.input);
            try {
                const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
                console.log(`   ✅ Result:`, result);
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: typeof result === "string" ? result : JSON.stringify(result),
                });
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error(`   ❌ Tool error:`, errMsg);
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: `Error: ${errMsg}`,
                    is_error: true,
                });
            }
        }

        messages.push({ role: "user", content: toolResults });
    }

    if (!finalResponse) {
        finalResponse = "⚠️ Reached maximum tool iterations. Please try a simpler request.";
    }

    // 3. Log this exchange to conversation history
    logConversation(userId, userMessage, finalResponse);

    return finalResponse;
}
