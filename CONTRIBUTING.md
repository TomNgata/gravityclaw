# 🤝 Contributing to Gravity Claw

We welcome contributions! Please follow these guidelines to maintain the integrity of the swarm.

## 1. Repo Structure
- `src/`: Core logic and infrastructure.
- `src/memory/`: Database and vector management.
- `src/skills/`: Logic for loading dynamic skills.
- `src/mcp/`: MCP client and JSON-RPC bridge.
- `src/scheduler/`: Proactive briefings and task scheduling.
- `skills/`: The folder for behavior Markdown files.

## 2. Development Workflow
1. **Branching**: Create a feature branch from `master`.
2. **Coding**: Stick to TypeScript and functional/modular patterns.
3. **Testing**: Run `tsx verify_automation.ts` or similar scripts to validate changes.
4. **Committing**: Use descriptive commit messages.

## 3. Coding Standards
- **Interfaces First**: Define data structures/interfaces before implementing logic.
- **Async/Await**: Use modern async patterns throughout.
- **Error Handling**: Use `try/catch` and provide helpful logs via `console`.
- **Typing**: Avoid `any` unless absolutely necessary for external JSON parsing.

## 4. Proposing New Features
If you want to add a new major feature (like a new database provider or a new hosting adapter), please create a GAP analysis first to justify the complexity.
