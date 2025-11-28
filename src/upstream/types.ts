import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface UpstreamClient {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  isConnected(): boolean;
}
