import type Anthropic from "@anthropic-ai/sdk";
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

// ── Tool registry ──────────────────────────────────────────────────────
// Add new tools here: import their definition + execute, add to both arrays.

export const toolDefinitions: Anthropic.Tool[] = [
    getCurrentTimeDef,
    storeMemoryDef,
    recallMemoryDef,
    executeShellDef,
    readFileSystemDef,
    writeFileSystemDef,
];

const toolExecutors: Record<string, (input: Record<string, unknown>) => unknown> = {
    get_current_time: getCurrentTimeExec,
    store_memory: storeMemoryExec,
    recall_memory: recallMemoryExec,
    execute_shell: executeShellExec,
    read_file: readFileSystemExec,
    write_file: writeFileSystemExec,
};

// ── Dispatcher ─────────────────────────────────────────────────────────
export async function executeTool(
    name: string,
    input: Record<string, unknown>
): Promise<unknown> {
    const executor = toolExecutors[name];
    if (!executor) {
        throw new Error(`Unknown tool: "${name}"`);
    }
    return executor(input);
}
