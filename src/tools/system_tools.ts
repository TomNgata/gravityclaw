import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import type Anthropic from "@anthropic-ai/sdk";

const execAsync = promisify(exec);

// ── Execute Shell ──────────────────────────────────────────────────────
export const executeShellDef: Anthropic.Tool = {
    name: "execute_shell",
    description: "Executes a shell command in the local terminal. Use for git, npm, file management, etc.",
    input_schema: {
        type: "object",
        properties: {
            command: { type: "string", description: "The command to execute" },
        },
        required: ["command"],
    },
};

export async function executeShellExec(input: Record<string, unknown>): Promise<unknown> {
    const command = input.command as string;
    try {
        const { stdout, stderr } = await execAsync(command);
        return { stdout, stderr };
    } catch (error: any) {
        return {
            stdout: error.stdout || "",
            stderr: error.stderr || error.message,
        };
    }
}

// ── Read File ──────────────────────────────────────────────────────────
export const readFileSystemDef: Anthropic.Tool = {
    name: "read_file",
    description: "Reads the content of a file from the file system.",
    input_schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "Relative or absolute path to the file" },
        },
        required: ["path"],
    },
};

export async function readFileSystemExec(input: Record<string, unknown>): Promise<unknown> {
    const path = input.path as string;
    try {
        const absolutePath = resolve(process.cwd(), path);
        return await readFile(absolutePath, "utf-8");
    } catch (error: any) {
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

// ── Write File ─────────────────────────────────────────────────────────
export const writeFileSystemDef: Anthropic.Tool = {
    name: "write_file",
    description: "Writes or updates a file in the file system.",
    input_schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "Path to the file to create/update" },
            content: { type: "string", description: "Full content to write to the file" },
        },
        required: ["path", "content"],
    },
};

export async function writeFileSystemExec(input: Record<string, unknown>): Promise<unknown> {
    const path = input.path as string;
    const content = input.content as string;
    try {
        const absolutePath = resolve(process.cwd(), path);
        await writeFile(absolutePath, content, "utf-8");
        return `Successfully wrote to ${path}`;
    } catch (error: any) {
        throw new Error(`Failed to write file: ${error.message}`);
    }
}
