import { spawn, ChildProcess } from "child_process";
import { JSONRPCClient } from "json-rpc-2.0";
import type { ToolDefinition } from "../tools/index.js";

export interface MCPServerConfig {
    name: string;
    command: string;
    args: string[];
}

export class MCPClient {
    private client: JSONRPCClient;
    private process: ChildProcess;

    constructor(private config: MCPServerConfig) {
        this.process = spawn(config.command, config.args, {
            stdio: ["pipe", "pipe", "inherit"],
            shell: true,
        });

        this.client = new JSONRPCClient((request) => {
            try {
                this.process.stdin?.write(JSON.stringify(request) + "\n");
                return Promise.resolve();
            } catch (error) {
                return Promise.reject(error);
            }
        });

        this.process.stdout?.on("data", (data) => {
            const lines = data.toString().split("\n");
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    this.client.receive(JSON.parse(line));
                } catch (e) {
                    // Ignore non-JSON output
                }
            }
        });
    }

    async initialize(): Promise<void> {
        try {
            await this.client.request("initialize", {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "gravity-claw", version: "1.0.0" },
            });
            await this.client.notify("notifications/initialized", {});
            console.log(`🔌 [MCP:${this.config.name}] Initialized successfully.`);
        } catch (error) {
            console.error(`❌ [MCP:${this.config.name}] Initialization failed:`, error);
            throw error;
        }
    }

    async listTools(): Promise<ToolDefinition[]> {
        try {
            const response: any = await this.client.request("tools/list", {});
            return response.tools.map((tool: any) => ({
                name: `${this.config.name}__${tool.name}`,
                description: `[MCP: ${this.config.name}] ${tool.description}`,
                input_schema: tool.inputSchema,
            }));
        } catch (error) {
            console.error(`❌ [MCP:${this.config.name}] Failed to list tools:`, error);
            return [];
        }
    }

    async callTool(name: string, args: any): Promise<any> {
        try {
            // Strip the server prefix before calling the remote tool
            const realName = name.replace(`${this.config.name}__`, "");
            console.log(`🔧 [MCP:${this.config.name}] Calling tool: ${realName}`);
            const response: any = await this.client.request("tools/call", {
                name: realName,
                arguments: args,
            });
            return response.content; // Content is usually an array of items for MCP
        } catch (error) {
            console.error(`❌ [MCP:${this.config.name}] Tool call failed (${name}):`, error);
            return { error: `MCP Tool call failed: ${error}` };
        }
    }

    destroy() {
        this.process.kill();
    }
}
