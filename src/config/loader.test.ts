import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig } from "./loader.js";

describe("ConfigLoader", () => {
  let tempDir: string;
  let configPath: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-proxy-test-"));
    configPath = join(tempDir, "config.yaml");
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    try {
      unlinkSync(configPath);
    } catch {
      // ignore
    }
  });

  it("YAML設定ファイルを読み込みデフォルト値を適用する", () => {
    const yaml = `
upstreams:
  server1:
    type: stdio
    command: node
    args:
      - server.js
  server2:
    type: http
    url: http://localhost:3000
`;
    writeFileSync(configPath, yaml);

    const config = loadConfig(configPath);

    // デフォルト値
    expect(config.proxy.name).toBe("mcp-proxy-gateway");
    expect(config.proxy.namespacing.enabled).toBe(true);
    // stdio upstream
    expect(config.upstreams.server1.type).toBe("stdio");
    if (config.upstreams.server1.type === "stdio") {
      expect(config.upstreams.server1.command).toBe("node");
    }
    // http upstream
    expect(config.upstreams.server2.type).toBe("http");
  });

  it("環境変数を展開する（${VAR}と${VAR:-default}形式）", () => {
    process.env.TEST_CMD = "my-command";
    delete process.env.UNSET_VAR;

    const yaml = `
env:
  CUSTOM: custom-value
upstreams:
  test1:
    type: stdio
    command: \${TEST_CMD}
  test2:
    type: stdio
    command: \${UNSET_VAR:-fallback}
  test3:
    type: stdio
    command: \${CUSTOM}
`;
    writeFileSync(configPath, yaml);

    const config = loadConfig(configPath);

    if (config.upstreams.test1.type === "stdio") {
      expect(config.upstreams.test1.command).toBe("my-command");
    }
    if (config.upstreams.test2.type === "stdio") {
      expect(config.upstreams.test2.command).toBe("fallback");
    }
    if (config.upstreams.test3.type === "stdio") {
      expect(config.upstreams.test3.command).toBe("custom-value");
    }
  });

  it("不正な設定ファイルでエラーを投げる", () => {
    // 必須フィールド欠落
    writeFileSync(configPath, "upstreams:\n  test:\n    type: stdio\n");
    expect(() => loadConfig(configPath)).toThrow(/Invalid config/);

    // 無効なtype
    writeFileSync(configPath, "upstreams:\n  test:\n    type: invalid\n    command: echo\n");
    expect(() => loadConfig(configPath)).toThrow(/Invalid config/);
  });
});
