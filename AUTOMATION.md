# ⚡ Automation & Skills

Gravity Claw is highly extensible through its dual automation system: the **MCP Tool Bridge** and the **Dynamic Skills Loader**.

## 1. MCP Tool Bridge
Gravity Claw supports the **Model Context Protocol (MCP)**, allowing the agent to use thousands of external tools.

### Configuration (`mcp_servers.json`)
List your MCP servers in the root directory:
```json
[
    {
        "name": "everything",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
]
```
The agent automatically connects to these via `stdio` on startup and exposes their tools to the LLM.

## 2. Skills System
Skills are specialized behavior instructions loaded dynamically from the `/skills` directory.

### How it Works
1. Create a `.md` file in the `/skills/` folder.
2. Define the behavior, rules, and triggers in the file.
3. On startup, the bot parses these files into a single "Skill Context" injected into the system prompt.

### Example Skill (`skills/expert_logic.md`)
```markdown
# Expert Logic
When the user asks for a deduction, use symbolic logic markers (P1, P2, C) and provide a Reasoning Integrity Score.
```

## 3. Difference Between Tools and Skills
- **Tools (MCP)**: For **actions** (e.g., fetching a URL, editing a file, checking weather).
- **Skills (Markdown)**: For **behavior and style** (e.g., acting as a lawyer, using specific logic patterns, following a workflow).
