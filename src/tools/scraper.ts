import { config } from "../config.js";
import axios from "axios";

export const scraperDef = {
    name: "scraper",
    description: "Visits a website URL and pulls the content (converted to clean Markdown). Use this to research websites, read articles, or pull information from documentation/GitHub.",
    input_schema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "The full URL of the website to scrape (including http/https)."
            }
        },
        required: ["url"]
    }
};

export async function scraperExec(input: Record<string, any>): Promise<string> {
    const { url } = input;
    if (!url) {
        throw new Error("Missing 'url' parameter for scraper.");
    }

    if (!config.firecrawlApiKey) {
        return "Error: FIRECRAWL_API_KEY is not configured. Please add it to your environment variables.";
    }

    console.log(`🔍 [Scraper] Scraping URL: ${url}`);

    try {
        const response = await axios.post(
            "https://api.firecrawl.dev/v1/scrape",
            {
                url: url,
                formats: ["markdown"]
            },
            {
                headers: {
                    "Authorization": `Bearer ${config.firecrawlApiKey}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000 // 30 second timeout
            }
        );

        if (response.data && response.data.success && response.data.data && response.data.data.markdown) {
            return response.data.data.markdown;
        } else {
            console.error("❌ [Scraper] Firecrawl returned an unsuccessful response:", response.data);
            return `Failed to scrape content from ${url}. The service returned an error or no markdown content.`;
        }
    } catch (error: any) {
        console.error(`❌ [Scraper] Error scraping ${url}:`, error.message);
        if (error.response) {
            return `Error scraping ${url}: ${error.response.status} ${error.response.statusText}. ${JSON.stringify(error.response.data)}`;
        }
        return `Error scraping ${url}: ${error.message}`;
    }
}
