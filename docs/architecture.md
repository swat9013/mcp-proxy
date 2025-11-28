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
           │ stdio       │ http/sse    │ stdio
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

- HTTP(SSE)型MCPサーバーへの接続
- MCP SDK の `SSEClientTransport` を使用

### ToolRegistry (`src/registry/tool-registry.ts`)

- 上流MCPからツール一覧を取得
- `allowedTools`によるフィルタリング
- 説明文の圧縮（`toolDescriptionOverrides`）
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

### 未実装（必要に応じて追加）

| メソッド | 説明 |
|---------|------|
| `resources/list` | リソース一覧取得 |
| `resources/read` | リソース読み取り |
| `prompts/list` | プロンプト一覧取得 |
