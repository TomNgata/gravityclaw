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

### Level 9: Cognitive Memory Layer
- **Goal**: Move from simple keyword/FTS search to semantic vector embeddings (semantic search).
- **Features**: 
    - Auto-summarization of long histories into "Knowledge Items" (KIs).
    - Importance-weighted context injection based on the specific expert model being used.
    - Persistent soul-memory that updates based on user preferences and shared experiences.

### Level 10: Multi-Modal Mastery
- **Goal**: Deep visual and auditory integration.
- **Features**:
    - Real-time vision expert (`gemma-3-12b`) triggered automatically for photo analyze requests.
    - Integrated speech-to-intent loops (directly turning voice to tool calls).
    - "DALL-E / Flux" bridge for generating visuals from text prompts within the chat.

### Level 11: Collaborative Consensus
- **Goal**: Intra-swarm deliberation.
- **Features**:
    - **Critic-Member Pattern**: Before a final response is sent, the Router asks a separate "critic" model to verify the code or logic.
    - **Consensus Loop**: For high-stakes decisions (file deletion, system config), multiple models must "vote" or agree.
    - Swarm-wide reflection steps to improve the quality of responses before delivery.

### Level 12: Autonomous Workflow Engineering
- **Goal**: Direct environmental manipulation and self-extension.
- **Features**:
    - Ability for the swarm to identify missing functionality and write its own MCP tools.
    - End-to-end task execution (e.g., "Build me a React app and deploy it on Railway") without manual intervention.
    - Dynamic environment management (installing packages, running builds, debugging failures autonomously).

### Level 13: Self-Improving Swarm (Recursive Optimization)
- **Goal**: Self-tuning and performance optimization.
- **Features**:
    - The swarm analyzes its own logs to identify which models are failing or yielding poor results.
    - Autonomous re-ranking of the expert list based on real-world performance metrics.
    - Recursive prompt optimization: The orchestrator rewrites expert prompts to improve clarity and reduce token consumption.
