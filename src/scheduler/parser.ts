import OpenAI from "openai";
import { config } from "../config.js";

// Ensure we have a valid key before attempting
const openai = config.openaiApiKey 
    ? new OpenAI({ apiKey: config.openaiApiKey }) 
    : new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: config.openRouterApiKey });

/**
 * Converts natural language (e.g., "every day at 9am", "in 5 minutes") into a standard 5-part cron expression.
 */
export async function parseNaturalLanguageToCron(nlInput: string): Promise<string | null> {
    const fallbackQueue = config.openaiApiKey 
        ? ["gpt-4o-mini", "gpt-3.5-turbo"]
        : [
            "mistralai/mistral-small-3.1-24b-instruct:free",
            "google/gemma-3-12b-it:free"
          ];

    const systemPrompt = `You are a strict scheduling assistant. 
Convert the following natural language time request into a standard 5-part cron expression (minute hour day month day-of-week).
Return ONLY the raw cron string. Do not include quotes, markdown formatting, or any explanatory text.
If the input cannot be parsed into a recurring cron job or a single future event, return "INVALID".
Assume the user's timezone implicitly relative to current UTC time.

Examples:
- "every day at 9am" -> 0 9 * * *
- "every 5 minutes" -> */5 * * * *
- "every monday at 2pm" -> 0 14 * * 1
`;

    for (const model of fallbackQueue) {
        try {
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: nlInput }
                ],
                temperature: 0.1,
                max_tokens: 50,
            });

            let result = completion.choices?.[0]?.message?.content?.trim();
            
            if (!result || result === "INVALID") {
                continue; // Try next model
            }

            console.log(`[Parser Raw Output] Model: ${model} ->\n${result}`);

            // Robust extraction: Look for exactly 5 parts consisting of numbers, *, /, -, or ,
            const cronRegex = /((?:[0-9*/,-]+\s+){4}[0-9*/,-]+)/;
            const match = result.match(cronRegex);

            if (match && match[1]) {
                const extractedCron = match[1].trim();
                // Basic validation: 5 distinct parts
                if (extractedCron.split(/\s+/).length === 5) {
                    console.log(`✅ [Parser Extracted]: ${extractedCron}`);
                    return extractedCron;
                }
            }
            
            console.log(`⚠️ [Parser Warning] Model ${model} returned unparseable content.`);

        } catch (error: any) {
            console.error(`Cron parser errored on ${model}:`, error.message);
        }
    }

    console.error("[Parser Error] All models in queue failed or returned invalid cron.");
    return null;
}
