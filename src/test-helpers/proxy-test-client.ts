/**
 * E2Eテスト用のProxyServerクライアント
 *
 * ProxyServerを子プロセスとして起動し、JSON-RPC over stdioで通信する。
 */

import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ============================================================================
// 型定義
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolsListResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// ============================================================================
// ProxyTestClient
// ============================================================================

/**
 * ProxyServerを起動し、JSON-RPCでやり取りするテストクライアント
 */
export class ProxyTestClient {
  private process: ChildProcess | null = null;
  private buffer = "";
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  async start(configPath: string): Promise<void> {
    const distPath = join(process.cwd(), "dist", "index.js");

    this.process = spawn("node", [distPath, "--config", configPath], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // 起動を待つ
    await new Promise((resolve) => setTimeout(resolve, 500));

    // initializeリクエスト
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + "\n");

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async listTools(): Promise<ToolsListResult> {
    return (await this.request("tools/list")) as ToolsListResult;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    return (await this.request("tools/call", { name, arguments: args })) as ToolCallResult;
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // JSONでない行は無視
      }
    }
  }
}

// ============================================================================
// テストフィクスチャ
// ============================================================================

export interface TestFixture {
  client: ProxyTestClient;
  configPath: string;
  tempDir: string;
  cleanup: () => Promise<void>;
}

/**
 * テスト用フィクスチャを作成
 */
export async function createTestFixture(config: {
  allowedTools?: string[];
  extraFiles?: Array<{ path: string; content: string }>;
}): Promise<TestFixture> {
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-proxy-e2e-"));
  const configPath = join(tempDir, "config.yaml");

  const allowedToolsYaml = config.allowedTools
    ? `    allowedTools:\n${config.allowedTools.map((t) => `      - ${t}`).join("\n")}`
    : "";

  const yaml = `
upstreams:
  filesystem:
    type: stdio
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/tmp"
${allowedToolsYaml}
`;
  writeFileSync(configPath, yaml);

  // 追加ファイルを作成
  const createdFiles: string[] = [];
  for (const file of config.extraFiles || []) {
    writeFileSync(file.path, file.content);
    createdFiles.push(file.path);
  }

  const client = new ProxyTestClient();
  await client.start(configPath);

  return {
    client,
    configPath,
    tempDir,
    cleanup: async () => {
      await client.stop();
      try {
        unlinkSync(configPath);
        for (const file of createdFiles) {
          if (existsSync(file)) {
            unlinkSync(file);
          }
        }
      } catch {
        // ignore
      }
    },
  };
}
