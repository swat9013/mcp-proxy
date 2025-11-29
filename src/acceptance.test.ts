/**
 * MCP Proxy Gateway 受け入れテスト
 *
 * このテストは、MCP Proxy Gatewayの**目的**を満たしているかを検証します。
 *
 * ## ツールの目的
 * 「複数のMCPサーバーをラップし、ツール定義を圧縮してClaude Codeに公開する」
 *
 * ## 核心的な価値
 * 1. コンテキスト削減 - ツール定義の圧縮で50-75%のトークン削減
 * 2. ツールフィルタリング - 必要なツールのみを公開
 * 3. 名前空間管理 - ツール名衝突を回避
 * 4. 複数MCP対応 - stdio型/HTTP(SSE)型の両方をサポート
 *
 * ## テスト方針
 * - 実際のMCPサーバー（filesystem MCP）を使用したE2Eテスト
 * - モックは使用しない
 * - 目的の達成を検証することにフォーカス
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import {
  ProxyTestClient,
  createTestFixture,
  type TestFixture,
  type ToolsListResult,
} from "./test-helpers/proxy-test-client.js";

// ============================================================================
// 目的1: コンテキスト削減
// ============================================================================

describe("目的1: コンテキスト削減", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture({});
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("ツール説明が圧縮される（最初の文のみ、100文字以内）", async () => {
    const { tools } = await fixture.client.listTools();

    for (const tool of tools) {
      if (tool.description) {
        // ピリオドが最大1つ
        const periodCount = (tool.description.match(/\./g) || []).length;
        expect(periodCount).toBeLessThanOrEqual(1);
        // 100文字以内
        expect(tool.description.length).toBeLessThanOrEqual(100);
      }
    }
  });

  it("inputSchemaからdescription/titleが削除される", async () => {
    const { tools } = await fixture.client.listTools();

    for (const tool of tools) {
      const props = tool.inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
      if (props) {
        for (const prop of Object.values(props)) {
          expect(prop.description).toBeUndefined();
          expect(prop.title).toBeUndefined();
        }
      }
    }
  });
});

// ============================================================================
// 目的2: ツールフィルタリング
// ============================================================================

describe("目的2: ツールフィルタリング", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture({
      allowedTools: ["read_file", "list_directory"],
    });
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("allowedToolsで指定したツールのみが公開される", async () => {
    const { tools } = await fixture.client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(tools).toHaveLength(2);
    expect(toolNames).toContain("filesystem__read_file");
    expect(toolNames).toContain("filesystem__list_directory");
    expect(toolNames).not.toContain("filesystem__write_file");
  });
});

// ============================================================================
// 目的3: 名前空間管理
// ============================================================================

describe("目的3: 名前空間管理", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture({
      allowedTools: ["list_directory"],
    });
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("ツール名に上流名のプレフィックスが付与される", async () => {
    const { tools } = await fixture.client.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("filesystem__list_directory");
  });

  it("名前空間付きツール名で正しくルーティングされる", async () => {
    const result = await fixture.client.callTool("filesystem__list_directory", { path: "/tmp" });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe("text");
  });
});

// ============================================================================
// 目的4: 複数MCP対応（stdio型）
// ============================================================================

describe("目的4: 複数MCP対応（stdio型）", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture({
      allowedTools: ["list_directory"],
    });
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("stdio型MCPサーバーに接続してツール一覧を取得・実行できる", async () => {
    const { tools } = await fixture.client.listTools();
    expect(tools.length).toBeGreaterThan(0);

    const result = await fixture.client.callTool("filesystem__list_directory", { path: "/tmp" });
    expect(result.content).toBeDefined();
  });
});

// ============================================================================
// E2E: プロキシ基本動作
// ============================================================================

describe("E2E: プロキシ基本動作", () => {
  let fixture: TestFixture;
  let testFilePath: string;

  beforeAll(async () => {
    testFilePath = join("/private/tmp", `mcp-proxy-test-${Date.now()}.txt`);

    fixture = await createTestFixture({
      allowedTools: ["read_file", "list_directory"],
      extraFiles: [{ path: testFilePath, content: "Hello, MCP Proxy Gateway!" }],
    });
  }, 60000);

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("tools/listが正常に動作する", async () => {
    const { tools } = await fixture.client.listTools();

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
  });

  it("tools/callが正常に動作する", async () => {
    const result = await fixture.client.callTool("filesystem__read_file", { path: testFilePath });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Hello, MCP Proxy Gateway!");
  });

  it("存在しないツールを呼び出すとエラーを返す", async () => {
    const result = await fixture.client.callTool("nonexistent__tool", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });
});

// ============================================================================
// 設定: 環境変数展開
// ============================================================================

describe("設定: 環境変数展開", () => {
  let client: ProxyTestClient;
  let configPath: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    const { writeFileSync, mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");

    process.env.MCP_TEST_PATH = "/tmp";

    const tempDir = mkdtempSync(join(tmpdir(), "mcp-proxy-e2e-"));
    configPath = join(tempDir, "config.yaml");

    const yaml = `
upstreams:
  filesystem:
    type: stdio
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "\${MCP_TEST_PATH}"
    allowedTools:
      - list_directory
`;
    writeFileSync(configPath, yaml);

    client = new ProxyTestClient();
    await client.start(configPath);
  }, 60000);

  afterAll(async () => {
    process.env = originalEnv;
    await client.stop();
    const { unlinkSync } = await import("fs");
    try {
      unlinkSync(configPath);
    } catch {
      // ignore
    }
  });

  it("環境変数が正しく展開されてMCPサーバーが動作する", async () => {
    const result = await client.callTool("filesystem__list_directory", { path: "/tmp" });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
  });
});
