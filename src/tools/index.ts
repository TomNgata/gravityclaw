export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: any;
}

import {
    definition as getCurrentTimeDef,
    execute as getCurrentTimeExec,
} from "./get_current_time.js";
import {
    storeMemoryDef,
    storeMemoryExec,
    recallMemoryDef,
    recallMemoryExec,
} from "./memory_tools.js";
import {
    executeShellDef,
    executeShellExec,
    readFileSystemDef,
    readFileSystemExec,
    writeFileSystemDef,
    writeFileSystemExec,
} from "./system_tools.js";

import { config } from "../config.js";
import { MCPClient } from "../mcp/client.js";

// ── Internal Tool Executors ──────────────────────────────────────────
const internalExecutors: Record<string, (input: Record<string, unknown>, chatId?: number) => unknown> = {
    get_current_time: getCurrentTimeExec,
    store_memory: storeMemoryExec,
    recall_memory: recallMemoryExec,
    execute_shell: executeShellExec,
    read_file: readFileSystemExec,
    write_file: writeFileSystemExec,
};

// ── State ──────────────────────────────────────────────────────────
export let toolDefinitions: ToolDefinition[] = [
    getCurrentTimeDef,
    storeMemoryDef,
    recallMemoryDef,
    executeShellDef,
    readFileSystemDef,
    writeFileSystemDef,
];

const mcpClients: Record<string, MCPClient> = {};

// ── Initialization ───────────────────────────────────────────────────
export async function initializeTools(): Promise<void> {
    console.log("🛠️  Initializing tools...");

    for (const serverConfig of config.mcpServers) {
        try {
            console.log(`🔌 Connecting to MCP server: ${serverConfig.name}...`);
            const client = new MCPClient(serverConfig);
            await client.initialize();
            const tools = await client.listTools();

            toolDefinitions.push(...tools);
            mcpClients[serverConfig.name] = client;
            console.log(`✅ Loaded ${tools.length} tools from ${serverConfig.name}`);
        } catch (error) {
            console.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
        }
    }
}

// ── Dispatcher ─────────────────────────────────────────────────────────
export async function executeTool(
    name: string,
    input: Record<string, unknown>,
    chatId?: number
): Promise<unknown> {
    // 1. Check internal tools
    if (internalExecutors[name]) {
        return internalExecutors[name](input, chatId);
    }

    // 2. Check MCP tools (format: serverName__toolName)
    const [serverName] = name.split("__");
    const client = mcpClients[serverName];
    if (client) {
        return await client.callTool(name, input);
    }

    throw new Error(`Unknown tool: "${name}"`);
}
