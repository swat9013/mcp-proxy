import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { StdioUpstreamConfig } from "../config/schema.js";
import type { UpstreamClient } from "./types.js";
import { logger } from "../utils/logger.js";

export class StdioUpstreamClient implements UpstreamClient {
  readonly name: string;
  private config: StdioUpstreamConfig;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor(name: string, config: StdioUpstreamConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(`Connecting to upstream: ${this.name}`);

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      stderr: "inherit",
    });

    this.client = new Client(
      { name: `mcp-proxy-${this.name}`, version: "1.0.0" },
      { capabilities: {} }
    );

    // 接続タイムアウト（10秒）- Claude Code側のタイムアウト前に完了する必要がある
    const timeoutMs = 10000;
    const connectPromise = this.client.connect(this.transport);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    this.connected = true;

    logger.info(`Connected to upstream: ${this.name}`);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info(`Disconnecting from upstream: ${this.name}`);

    try {
      await this.client?.close();
    } catch (err) {
      logger.warn(`Error closing client for ${this.name}:`, err);
    }

    this.client = null;
    this.transport = null;
    this.connected = false;
  }

  async listTools(): Promise<Tool[]> {
    if (!this.client || !this.connected) {
      throw new Error(`Upstream ${this.name} is not connected`);
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.client || !this.connected) {
      throw new Error(`Upstream ${this.name} is not connected`);
    }

    const result = await this.client.callTool({ name, arguments: args });
    return result as CallToolResult;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
