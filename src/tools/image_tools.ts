/**
 * Generates an image using Pollinations.ai (Free/No-Key).
 */
export async function generateImage(input: { prompt: string }): Promise<string> {
    const encodedPrompt = encodeURIComponent(input.prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    // We don't strictly need to "download" it here as the URL itself is the result,
    // but we return the URL so the agent can send it to the user.
    return imageUrl;
}

export const imageTools = [
    {
        name: "generate_image",
        description: "Generate a beautiful image from a text prompt. Useful for creative requests, wallpapers, or visualizing ideas.",
        input_schema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "The detailed text description of the image to generate.",
                },
            },
            required: ["prompt"],
        } as const,
    },
];
