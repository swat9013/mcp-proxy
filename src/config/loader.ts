import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { ConfigSchema, type Config } from "./schema.js";

/**
 * 環境変数を展開する
 * ${VAR} または ${VAR:-default} 形式をサポート
 */
function expandEnvVars(value: string, envOverrides: Record<string, string> = {}): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const [varName, defaultValue] = expr.split(":-");
    return envOverrides[varName] ?? process.env[varName] ?? defaultValue ?? "";
  });
}

/**
 * オブジェクト内の全ての文字列値に対して環境変数を展開する
 */
function expandEnvVarsInObject<T>(obj: T, envOverrides: Record<string, string> = {}): T {
  if (typeof obj === "string") {
    return expandEnvVars(obj, envOverrides) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, envOverrides)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value, envOverrides);
    }
    return result as T;
  }
  return obj;
}

export function loadConfig(configPath: string): Config {
  const content = readFileSync(configPath, "utf-8");
  const rawConfig = parseYaml(content);

  // 環境変数オーバーライドを取得
  const envOverrides = rawConfig.env ?? {};
  const expandedEnvOverrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(envOverrides)) {
    if (typeof value === "string") {
      expandedEnvOverrides[key] = expandEnvVars(value, {});
    }
  }

  // 環境変数を展開
  const expandedConfig = expandEnvVarsInObject(rawConfig, expandedEnvOverrides);

  // バリデーション
  const result = ConfigSchema.safeParse(expandedConfig);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }

  return result.data;
}
