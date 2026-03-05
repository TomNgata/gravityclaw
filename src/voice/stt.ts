import OpenAI from "openai";
import { config } from "../config.js";
import { createReadStream } from "fs";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Transcribes an audio file using OpenAI Whisper.
 * @param filePath Path to the audio file (e.g., .ogg or .mp3)
 * @returns Transcribed text
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: createReadStream(filePath),
            model: "whisper-1",
        });
        return transcription.text;
    } catch (error) {
        console.error("STT Error:", error);
        throw new Error("Failed to transcribe audio.");
    }
}
