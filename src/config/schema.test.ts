import { describe, it, expect } from "vitest";
import { ConfigSchema } from "./schema.js";

describe("ConfigSchema", () => {
  it("設定を受け入れデフォルト値を適用する", () => {
    const input = {
      upstreams: {
        server1: {
          type: "stdio" as const,
          command: "node",
          args: ["server.js"],
          allowedTools: ["tool1"],
        },
        server2: {
          type: "http" as const,
          url: "http://localhost:3000",
        },
      },
    };

    const result = ConfigSchema.parse(input);

    // stdio upstream
    expect(result.upstreams.server1.type).toBe("stdio");
    expect(result.upstreams.server1.allowedTools).toEqual(["tool1"]);
    // http upstream
    expect(result.upstreams.server2.type).toBe("http");
  });

  it("最小限の設定でデフォルト値が適用される", () => {
    const input = {
      upstreams: {
        test: { type: "stdio" as const, command: "echo" },
      },
    };

    const result = ConfigSchema.parse(input);

    if (result.upstreams.test.type === "stdio") {
      expect(result.upstreams.test.args).toEqual([]);
    }
  });

  it("無効な設定でエラーを投げる", () => {
    // upstreams欠落
    expect(() => ConfigSchema.parse({})).toThrow();
    // 無効なtype
    expect(() =>
      ConfigSchema.parse({ upstreams: { test: { type: "invalid" } } })
    ).toThrow();
    // 無効なURL
    expect(() =>
      ConfigSchema.parse({ upstreams: { test: { type: "http", url: "invalid" } } })
    ).toThrow();
  });
});
