# Gravity Claw: The Building Roadmap

This document outlines the evolutionary stages of the Gravity Claw agentic swarm.

## ✅ Phase 1: Foundation & Stability
- **Level 1-6**: Initial MCP core, memory implementation, and basic multi-model support.
- **Level 7 (Optimized Swarm V2)**: Stable orchestration and basic fallbacks.
- **Level 8 (Optimized Swarm V3)**: [COMPLETE]
  - Integrated 10+ high-tier and "free" OpenRouter models.
  - StepFun 3.5 Flash reassigned as primary **Router** and **Agentic Expert**.
  - Implemented a 3-ranked expert model queue with fault-tolerant fallback loops.
  - Successfully resolved rebase and dependency conflicts to finalize the Swarm's orchestration logic.

---

## 🚀 Phase 2: Intelligence & Autonomy (The Next 5 Levels)

### Level 9: Cognitive Memory Layer [COMPLETE]
- **Goal**: Move from simple keyword/FTS search to semantic vector embeddings (semantic search).
- **Features**: 
    - Auto-summarization of long histories into "Knowledge Items" (KIs).
    - Importance-weighted context injection based on the specific expert model being used.
    - Persistent soul-memory that updates based on user preferences and shared experiences.

### Level 10: Multi-Modal Mastery & Proactive Vitality [COMPLETE]
- **Goal**: Deep visual/auditory integration and recursive self-monitoring.
- **Features**:
    - **Voice Integration (ElevenLabs)**: Realistic human-sounding voices for Telegram voice note replies.
    - **Heartbeat System**: Autonomous background cycles where Claw checks its own status, environment (Railway logs), and pending tasks every hour.
    - **Real-time Vision**: Automatic `gemma-3-12b` analysis for photo/document uploads.
    - **Morning Briefing**: Proactive daily summary of news, GitHub activity, and memory insights.

### Level 11: Collaborative Consensus & Skills System
- **Goal**: Intra-swarm deliberation and extensible capability modules.
- **Features**:
    - **Skills System**: A "no-code" plugin architecture where new capabilities are added via markdown "Skill Files".
    - **Critic-Member Pattern**: Multi-model verification of complex code or logic before response.
    - **Consensus Loop**: Voting-based decision making for high-stakes environmental actions.

### Level 12: Autonomous Workflow Engineering
- **Goal**: Direct environmental manipulation and self-extension.
- **Features**:
    - **Auto-MCP Generation**: The swarm identifies missing tools and writes its own MCP server code.
    - **End-to-End Orchestration**: High-level objective execution (e.g., "Build and deploy a feature").
    - **Multi-Channel Router**: Extending to WhatsApp/Slack for a unified cross-platform brain.

### Level 13: Self-Improving Swarm (Recursive Optimization)
- **Goal**: Self-tuning and performance optimization.
- **Features**:
    - **Usage & Performance Tracking**: Monitoring cost and latency per model.
    - **Autonomous Re-ranking**: Real-time adjustments to the expert queue based on error rates (429s).
    - **Recursive Prompt Engineering**: Self-rewriting system prompts for better clarity.
