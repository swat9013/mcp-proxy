import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "./tool-registry.js";
import type { Config } from "../config/schema.js";
import type { UpstreamManager } from "../upstream/manager.js";
import type { UpstreamClient } from "../upstream/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

function createMockClient(tools: Tool[]): UpstreamClient {
  return {
    name: "mock",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue(tools),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    isConnected: vi.fn().mockReturnValue(true),
  };
}

function createMockManager(clients: Map<string, UpstreamClient>): UpstreamManager {
  return {
    getClient: (name: string) => clients.get(name),
    getAllClients: () => clients,
  } as unknown as UpstreamManager;
}

describe("ToolRegistry", () => {
  it("ツールをフィルタリング・圧縮・名前空間付与して登録する", async () => {
    const tools: Tool[] = [
      {
        name: "tool1",
        description: "First sentence. Second sentence.",
        inputSchema: {
          type: "object",
          properties: { param: { type: "string", description: "removed" } },
        },
      },
      { name: "tool2", description: "Tool 2", inputSchema: { type: "object" } },
      { name: "tool3", description: "Tool 3", inputSchema: { type: "object" } },
    ];

    const config: Config = {
      proxy: { name: "test", version: "1.0.0", namespacing: { enabled: true, separator: "__" } },
      upstreams: {
        server1: {
          type: "stdio",
          command: "echo",
          args: [],
          allowedTools: ["tool1", "tool3"],
          toolDescriptionOverrides: { tool3: "Custom desc" },
        },
      },
    };

    const clients = new Map<string, UpstreamClient>();
    clients.set("server1", createMockClient(tools));
    const registry = new ToolRegistry(config, createMockManager(clients));

    await registry.refreshTools();
    const result = registry.getTools();

    // フィルタリング: tool1, tool3のみ
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(["server1__tool1", "server1__tool3"]);

    // 説明圧縮: 最初の文のみ
    expect(result[0].description).toBe("First sentence");
    // オーバーライド
    expect(result[1].description).toBe("Custom desc");

    // inputSchema圧縮: descriptionが削除されている
    const schema = result[0].inputSchema as { properties?: Record<string, Record<string, unknown>> };
    expect(schema.properties?.param.description).toBeUndefined();
    expect(schema.properties?.param.type).toBe("string");
  });

  it("名前空間付きツール名を解決できる", async () => {
    const tools: Tool[] = [{ name: "mytool", inputSchema: { type: "object" } }];
    const config: Config = {
      proxy: { name: "test", version: "1.0.0", namespacing: { enabled: true, separator: "__" } },
      upstreams: { server1: { type: "stdio", command: "echo", args: [] } },
    };

    const clients = new Map<string, UpstreamClient>();
    clients.set("server1", createMockClient(tools));
    const registry = new ToolRegistry(config, createMockManager(clients));

    await registry.refreshTools();

    const resolved = registry.resolveToolName("server1__mytool");
    expect(resolved).toEqual({ upstreamName: "server1", originalName: "mytool" });

    expect(registry.resolveToolName("nonexistent")).toBeNull();
  });

  it("namespacing無効時はプレフィックスを付与しない", async () => {
    const tools: Tool[] = [{ name: "tool1", inputSchema: { type: "object" } }];
    const config: Config = {
      proxy: { name: "test", version: "1.0.0", namespacing: { enabled: false, separator: "__" } },
      upstreams: { server1: { type: "stdio", command: "echo", args: [] } },
    };

    const clients = new Map<string, UpstreamClient>();
    clients.set("server1", createMockClient(tools));
    const registry = new ToolRegistry(config, createMockManager(clients));

    await registry.refreshTools();

    expect(registry.getTools()[0].name).toBe("tool1");
  });
});
