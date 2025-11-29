# アーキテクチャ

## 概要

MCP Proxy Gatewayは、Claude CodeとMCPサーバー間のプロキシとして機能し、ツール定義の圧縮とルーティングを行います。

## システム構成図

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
└─────────────────────┬───────────────────────────────────┘
                      │ stdio (JSON-RPC)
┌─────────────────────▼───────────────────────────────────┐
│              MCP Proxy Gateway                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ ConfigLoader│  │ ToolRegistry│  │ProxyServer  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              UpstreamManager                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ stdio    │  │ http     │  │ stdio    │        │ │
│  │  │ client   │  │ client   │  │ client   │        │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘        │ │
│  └───────┼─────────────┼─────────────┼──────────────┘ │
└──────────┼─────────────┼─────────────┼──────────────────┘
           │ stdio       │ http        │ stdio
     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
     │  serena   │ │ deepwiki  │ │ atlassian │
     │  MCP      │ │ MCP       │ │ MCP       │
     └───────────┘ └───────────┘ └───────────┘
```

## コンポーネント

### ConfigLoader (`src/config/loader.ts`)

- YAML設定ファイルの読み込み
- 環境変数の展開（`${VAR}`, `${VAR:-default}`形式）
- Zodによるバリデーション

### UpstreamManager (`src/upstream/manager.ts`)

- 複数の上流MCPクライアントを管理
- 接続/切断の一括制御
- クライアントの取得

### StdioUpstreamClient (`src/upstream/stdio-client.ts`)

- stdio型MCPサーバーへの接続
- 子プロセスの起動と管理
- MCP SDK の `StdioClientTransport` を使用

### HttpUpstreamClient (`src/upstream/http-client.ts`)

- HTTP型MCPサーバーへの接続
- MCP SDK の `StreamableHTTPClientTransport` を使用

### ToolRegistry (`src/registry/tool-registry.ts`)

- 上流MCPからツール一覧を取得
- `allowedTools`によるフィルタリング
- 説明文の自動圧縮（最初の文・100文字制限）
- inputSchemaの圧縮（description/titleフィールド削除）
- 名前空間プレフィックスの付与
- ツール名→上流MCPのマッピング管理

### ProxyServer (`src/server.ts`)

- MCPサーバーとしてClaude Codeからのリクエストを受付
- `tools/list`: 圧縮済みツール一覧を返却
- `tools/call`: 名前空間を解決し、適切な上流MCPにルーティング

## データフロー

### 起動時

```
1. ConfigLoader: 設定ファイル読み込み
2. UpstreamManager: 全上流MCPに接続
3. ToolRegistry: ツール一覧取得・フィルタリング・圧縮
4. ProxyServer: stdio transportで待機開始
```

### tools/list リクエスト

```
Claude Code → ProxyServer → ToolRegistry.getTools() → 圧縮済みツール一覧
```

### tools/call リクエスト

```
Claude Code
    ↓ tools/call { name: "serena__find_symbol", arguments: {...} }
ProxyServer
    ↓ ToolRegistry.resolveToolName("serena__find_symbol")
    ↓ → { upstreamName: "serena", originalName: "find_symbol" }
UpstreamManager.getClient("serena")
    ↓ callTool("find_symbol", {...})
serena MCP
    ↓ 結果
Claude Code
```

## MCPプロトコル

JSON-RPC 2.0 over stdio を使用。

### 主要メソッド

| メソッド | 説明 |
|---------|------|
| `initialize` | 接続初期化、capabilities交換 |
| `tools/list` | ツール一覧取得 |
| `tools/call` | ツール実行 |

### 未実装メソッド

以下のメソッドは現時点では未実装です。

| メソッド | 説明 | 実装優先度 |
|---------|------|-----------|
| `resources/list` | リソース一覧取得 | 低 |
| `resources/read` | リソース読み取り | 低 |
| `prompts/list` | プロンプト一覧取得 | 中 |
| `prompts/get` | プロンプト取得 | 中 |

#### 調査結果（2025年11月）

**Claude Codeの対応状況:**
- Resources: `@`メンションでMCPサーバーのリソースを参照可能
- Prompts: `/mcp__servername__promptname`形式でスラッシュコマンドとして利用可能
- 参考: [Claude Code MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)

**上流MCPサーバーの対応状況:**

| サーバー | Resources | Prompts | 備考 |
|---------|-----------|---------|------|
| Serena | 不明 | サポート | 設定ファイルでprompts定義可能 |
| DeepWiki | なし | なし | toolsのみ提供 |
| Atlassian | なし | 計画中 | コミュニティで議論中 |

**実装方針:**
- 現時点では上流サーバーがこれらの機能を積極的に使っていないため、実装は見送り
- Serenaのprompts対応が確認できれば `prompts/list` 実装を検討
- Atlassianがresources/promptsを実装したら対応を検討

**実装する場合の工数見積もり:**
- `resources/list` + `resources/read`: 2-3日
- `prompts/list` + `prompts/get`: 1-2日

参考リンク:
- [MCP Specification - Resources](https://spec.modelcontextprotocol.io/specification/server/resources/)
- [MCP Specification - Prompts](https://modelcontextprotocol.io/docs/concepts/prompts)
- [Serena GitHub](https://github.com/oraios/serena)
- [Atlassian MCP Community Discussion](https://community.atlassian.com/forums/Jira-questions/MCP-Feedback-Resources-Prompts/qaq-p/3083257)
