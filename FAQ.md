# ❓ Frequently Asked Questions (FAQ)

## 1. Why a "Swarm" instead of one AI?
Resilience. Single-model agents are vulnerable to rate limits, API outages, and specific model "hallucinations". By using a swarm, Gravity Claw can fallback through different providers and models, ensuring the user always gets a response.

## 2. What data is stored in the cloud?
Only your conversation history and semantic memories (facts you've told the bot) are stored in your private Supabase project. No telemetry or usage data is sent to external servers other than the AI providers (OpenRouter) during inference.

## 3. Can I run this entirely offline?
While Gravity Claw prefers local-first principles, it currently requires an internet connection for OpenRouter (model inference) and Supabase (sync). Future updates (Level 15+) aim to support local LLMs via Ollama.

## 4. Is it free to run?
Gravity Claw is designed to run on "Free Tier" infrastructure (Cloudflare, Supabase, Render, OpenRouter's free models). However, for heavy usage, we recommend upgrading to a paid Supabase tier to prevent project pausing.

## 5. How do I add my own models?
Modify the `getExpertModels` function in `src/agent.ts` to add or re-rank your preferred OpenRouter model IDs.

## 6. What happens if the Hub (Cloudflare) goes down?
The system is built for redundancy. You can point your Telegram bot directly to one of the Spokes (Railway/Render) using long-polling as a backup.
