[README.md](https://github.com/user-attachments/files/25825878/README.md)
# 🦀 Gravity Claw

**Gravity Claw** is a sophisticated, multi-model agentic swarm designed for high-availability, long-term memory, and autonomous task execution via Telegram. Built with a "local-first, cloud-synced" philosophy, it leverages distributed worker nodes (Cloudflare, Render, Railway) and a centralized Supabase "Swarm Brain" to ensure it remains nearly impossible to take offline.

---

## 🏗️ Architecture Summary

Gravity Claw operates as a **Distributed Swarm**:
- **Hub (Cloudflare)**: A lightweight Worker acting as the primary entry point and webhook handler.
- **Spokes (Railway/Render)**: High-performance compute nodes that handle complex LLM orchestration and long-running tasks.
- **Swarm Brain (Supabase)**: A centralized PostgreSQL database with `pgvector` support, providing cross-node semantic memory and conversation history.
- **LLM Swarm (OpenRouter)**: A fault-tolerant queue of expert models (GPT-4o, Llama 3.3, Claude, etc.) that the agent falls back through during rate limits or outages.

---

## ⚡ Key Features

- **Semantic Memory**: Uses OpenAI embeddings and `pgvector` to recall relevant facts from past conversations across different chat groups.
- **Group Management**: Isolated per-group memory, mention-based triggers, and admin-only security for sensitive commands.
- **Proactive Intelligence**: Morning briefings, evening recaps, and a "Heartbeat" system for smart recommendations.
- **MCP Tool Bridge**: Connects to any Model Context Protocol server via stdio for expanded automation capabilities.
- **Skills System**: Dynamic behavior injection via Markdown files in the `/skills` directory.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm
- Supabase Project (with `pgvector` enabled)
- Telegram Bot Token
- OpenRouter API Key

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your credentials.
4. (Optional) Configure MCP servers in `mcp_servers.json`.

---

## 🛠️ Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start the bot in development mode using `tsx`. |
| `npm run build` | Compile the TypeScript source code to `dist/`. |
| `npm start` | Run the compiled production build. |
| `tsc` | Run type checking across the codebase. |

---

## 🌍 Deployment

Gravity Claw is designed for multi-cloud resilience:
- **Cloudflare**: Use `wrangler deploy` to push the hub.
- **Railway/Render**: Use the provided PowerShell scripts (`railway_setup.ps1`) for semi-automated deployment.

---

## 📜 Documentation Suite

- [Architecture Guide](file:///C:/Users/Lenovo/Documents/gravityclaw/ARCHITECTURE.md): Deep dive into the swarm logic.
- [API Reference](file:///C:/Users/Lenovo/Documents/gravityclaw/API_REFERENCE.md): Endpoints and Webhook schemas.
- [Agent System](file:///C:/Users/Lenovo/Documents/gravityclaw/AGENT_SYSTEM.md): expert models and thinking levels.
- [Database Guide](file:///C:/Users/Lenovo/Documents/gravityclaw/DATABASE.md): Supabase schema and vector search.
- [Automation & Skills](file:///C:/Users/Lenovo/Documents/gravityclaw/AUTOMATION.md): MCP and Skills configuration.
- [Deployment Guide](file:///C:/Users/Lenovo/Documents/gravityclaw/DEPLOYMENT.md): Step-by-step multi-cloud setup.
