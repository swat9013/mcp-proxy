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

### 4. HTTP型MCP接続

```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("https://example.com/mcp"));
await client.connect(transport);
```

## テスト

### 自動テスト（vitest）

```bash
# テスト実行
npm test

# 単発実行（ウォッチモードなし）
npm test -- --run
```

#### テスト構成

| ファイル | 種別 | 内容 |
|---------|------|------|
| `src/config/loader.test.ts` | 単体 | YAML読み込み、環境変数展開、エラー処理 |
| `src/config/schema.test.ts` | 単体 | Zodスキーマバリデーション |
| `src/registry/tool-registry.test.ts` | 単体 | ツールフィルタリング・圧縮・名前空間 |
| `src/upstream/manager.test.ts` | 単体 | クライアント接続・切断・管理 |
| `src/acceptance.test.ts` | E2E | 目的ベースの受け入れテスト |

テストはハッピーパス中心の最小構成。

### 受け入れテスト

受け入れテスト（`src/acceptance.test.ts`）は、MCP Proxy Gatewayの**目的**を満たしているかを検証するE2Eテストです。

#### テスト方針

- 実際のMCPサーバー（filesystem MCP）を使用
- モックは使用しない
- ツールの目的（価値）の達成を検証

#### テストカテゴリ

| カテゴリ | 検証内容 |
|---------|----------|
| **目的1: コンテキスト削減** | 説明圧縮（最初の文のみ・100文字制限）、inputSchema圧縮 |
| **目的2: ツールフィルタリング** | allowedToolsによるツール制限 |
| **目的3: 名前空間管理** | プレフィックス付与、ルーティング |
| **目的4: 複数MCP対応** | stdio型MCPサーバーの接続・実行 |
| **E2E: プロキシ基本動作** | tools/list、tools/call、エラーハンドリング |
| **設定: 環境変数展開** | `${VAR}` 形式の環境変数展開 |

#### ヘルパー

テストヘルパーは `src/test-helpers/proxy-test-client.ts` に定義：

- `ProxyTestClient`: JSON-RPC over stdioでProxyServerと通信
- `createTestFixture()`: テスト用の設定ファイル・クライアントを自動セットアップ

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
