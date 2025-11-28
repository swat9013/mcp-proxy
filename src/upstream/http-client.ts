import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { HttpUpstreamConfig } from "../config/schema.js";
import type { UpstreamClient } from "./types.js";
import { logger } from "../utils/logger.js";

export class HttpUpstreamClient implements UpstreamClient {
  readonly name: string;
  private config: HttpUpstreamConfig;
  private client: Client | null = null;
  private connected = false;

  constructor(name: string, config: HttpUpstreamConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(`Connecting to HTTP upstream: ${this.name} at ${this.config.url}`);

    const transport = new SSEClientTransport(new URL(this.config.url));

    this.client = new Client(
      { name: `mcp-proxy-${this.name}`, version: "1.0.0" },
      { capabilities: {} }
    );

    await this.client.connect(transport);
    this.connected = true;

    logger.info(`Connected to HTTP upstream: ${this.name}`);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info(`Disconnecting from HTTP upstream: ${this.name}`);

    try {
      await this.client?.close();
    } catch (err) {
      logger.warn(`Error closing HTTP client for ${this.name}:`, err);
    }

    this.client = null;
    this.connected = false;
  }

  async listTools(): Promise<Tool[]> {
    if (!this.client || !this.connected) {
      throw new Error(`HTTP upstream ${this.name} is not connected`);
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.client || !this.connected) {
      throw new Error(`HTTP upstream ${this.name} is not connected`);
    }

    const result = await this.client.callTool({ name, arguments: args });
    return result as CallToolResult;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
