# 🤖 Agent System

Gravity Claw is not a single model; it is a **Swarm Orchestrator**. It manages a dynamic pool of specialized AI experts to ensure the highest quality response for any given task.

## 1. The Expert Swarm

The system ranks models based on their current availability and specialized strengths:

| Model | Primary Specialty | Use Case |
| :--- | :--- | :--- |
| `qwen/qwen3-coder:free` | Coding & Logic | Technical architecture, debugging, scripts. |
| `meta-llama/llama-3.3-70b-instruct:free` | Reasoning | Complex deductions, math, general instruction. |
| `google/gemma-3-12b-it:free` | Vision | Image analysis and multi-modal tasks. |
| `stepfun/step-3.5-flash:free` | Speed & Tool Use | Initial orchestration and fast tool calls. |

## 2. Orchestration Logic
1. **Routing**: The `getExpertModels` function analyzes the user prompt and returns a ranked list of 3 fallback models.
2. **Fallback Loop**: If the primary expert fails (due to rate limits or 5xx errors), the agent immediately attempts the next model in the list.
3. **Vision Trigger**: If an image is detected in the Telegram message, the Orchestrator automatically promotes the Vision expert to the #1 spot.

## 3. Thinking Levels
Users can control the reasoning depth via the `/think` command:
- **Low**: Concise, direct answers.
- **Medium**: Step-by-step logic.
- **High**: Exhaustive reasoning, exploring edge cases and multiple angles before concluding.

## 4. Personality & Identity
The agent's "soul" is defined by dynamic Markdown files loaded on startup:
- `soul.md`: Core identity and purpose.
- `identity.md`: Background and origin story.
- `personality.md`: Tone and stylistic preferences.

## 5. Memory Injection
Before processing, the agent is "initialized" with context from:
- **Semantic Memories**: Relevant past facts pulled via vector search.
- **Knowledge Items**: Static, hand-curated facts (KIs).
- **Skills**: Specialized instructions from `/skills`.
