# 開発ガイド

## 環境セットアップ

```bash
# 依存関係インストール
npm install

# ビルド
npm run build

# 開発モード（tsx使用）
npm run dev -- --config mcp-proxy.config.yaml

# テスト
npm test
```

## 技術スタック

| 技術 | 用途 |
|-----|------|
| TypeScript | 型安全な開発 |
| @modelcontextprotocol/sdk | MCP Server/Client実装 |
| Zod | 設定ファイルのバリデーション |
| yaml | YAML設定ファイルのパース |
| tsx | 開発時のTypeScript実行 |
| vitest | テストフレームワーク |

## MCP SDK 参考リソース

| リソース | URL |
|---------|-----|
| MCP公式仕様 | https://spec.modelcontextprotocol.io/ |
| MCP TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |
| MCP SDK ドキュメント | https://modelcontextprotocol.io/docs |
| サンプルサーバー実装 | https://github.com/modelcontextprotocol/servers |

## 実装時の注意点

### 1. ESモジュール形式

```typescript
// インポートには .js 拡張子を付ける
import { loadConfig } from "./config/loader.js";
```

### 2. ログ出力

stdioと競合しないよう、ログは必ずstderrに出力：

```typescript
// logger.ts で console.error を使用
console.error("[INFO] message");
```

### 3. StdioClientTransport の使用

MCP SDK v1.x では、StdioClientTransportがプロセス管理を行う：

```typescript
// 正しい使い方（SDK v1.x）
const transport = new StdioClientTransport({
  command: "uvx",
  args: ["serena", "start-mcp-server"],
  env: { ... },
  stderr: "inherit",
});

const client = new Client({ name: "proxy", version: "1.0.0" }, {});
await client.connect(transport);
```

### 4. HTTP(SSE)型MCP接続

```typescript
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(new URL("https://example.com/mcp"));
await client.connect(transport);
```

## テスト方法

### MCP Inspectorでテスト

```bash
# tools/list をテスト
npx @modelcontextprotocol/inspector --cli --method tools/list \
  node dist/index.js -- --config mcp-proxy.test.yaml

# tools/call をテスト（引数付き）
npx @modelcontextprotocol/inspector --cli --method tools/call \
  --tool-name filesystem__list_directory --tool-arg 'path=/tmp' \
  -- node dist/index.js --config mcp-proxy.test.yaml
```

### Claude Codeとの結合テスト

`.mcp.json`:
```json
{
  "mcpServers": {
    "proxy": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/dist/index.js", "--config", "mcp-proxy.config.yaml"]
    }
  }
}
```

```bash
# Claude Code起動
claude

# /mcp でツール一覧確認
```

## よくある問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| stdio通信が途切れる | バッファリングの問題 | `stderr: "inherit"` を設定 |
| 子プロセスが終了しない | シグナルハンドリング不足 | `process.on("exit")` でkill |
| JSON-RPCエラー | idフィールドの不整合 | SDK任せで問題なし |
| 非同期初期化の順序 | 接続完了前にリクエスト | `await connectAll()` を待つ |
| ツール名が見つからない | 名前空間の不一致 | `ToolRegistry.resolveToolName` を確認 |

## 新しい上流タイプの追加

1. `src/upstream/types.ts` の `UpstreamClient` インターフェースを実装
2. `src/config/schema.ts` に新しいスキーマを追加
3. `src/upstream/manager.ts` の `createClient` で分岐追加

```typescript
// 例: WebSocket型の追加
export class WebSocketUpstreamClient implements UpstreamClient {
  // ...
}
```

## 参考になる既存実装

| リポジトリ | 参考ポイント |
|-----------|-------------|
| [mcp-proxy](https://github.com/punkpeye/mcp-proxy) | MCPプロキシの基本構造 |
| [serena](https://github.com/oraios/serena) | stdio型MCPサーバー実装 |
| [mcp-remote](https://github.com/geelen/mcp-remote) | SSE→stdio変換 |
