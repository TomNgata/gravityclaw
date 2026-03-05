import OpenAI from "openai";
import { config } from "../config.js";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Synthesizes text into speech using OpenAI TTS.
 * @param text The text to synthesize
 * @returns Buffer containing the audio data (MP3)
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
    try {
        const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error("TTS Error:", error);
        throw new Error("Failed to synthesize speech.");
    }
}
