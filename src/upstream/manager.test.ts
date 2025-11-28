import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpstreamManager } from "./manager.js";
import type { Config } from "../config/schema.js";

vi.mock("./stdio-client.js", () => ({
  StdioUpstreamClient: vi.fn().mockImplementation((name: string) => ({
    name,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    isConnected: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock("./http-client.js", () => ({
  HttpUpstreamClient: vi.fn().mockImplementation((name: string) => ({
    name,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    isConnected: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("UpstreamManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("全upstreamに接続しクライアントを管理する", async () => {
    const config: Config = {
      proxy: { name: "test", version: "1.0.0", namespacing: { enabled: true, separator: "__" } },
      upstreams: {
        server1: { type: "stdio", command: "echo", args: [] },
        server2: { type: "http", url: "http://localhost:3000" },
      },
    };

    const manager = new UpstreamManager(config);
    await manager.connectAll();

    // クライアント取得
    expect(manager.getClient("server1")).toBeDefined();
    expect(manager.getClient("server2")).toBeDefined();
    expect(manager.getClient("nonexistent")).toBeUndefined();
    expect(manager.getAllClients().size).toBe(2);

    // 設定取得
    expect(manager.getUpstreamConfig("server1")?.type).toBe("stdio");
    expect(manager.getUpstreamConfig("server2")?.type).toBe("http");

    // 切断
    const client1 = manager.getClient("server1");
    await manager.disconnectAll();
    expect(client1?.disconnect).toHaveBeenCalled();
    expect(manager.getAllClients().size).toBe(0);
  });
});
