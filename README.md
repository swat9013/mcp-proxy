# MCP Proxy Gateway

複数のMCPサーバーをラップし、ツール定義を圧縮してClaude Codeに公開するプロキシゲートウェイ。

## 特徴

- **コンテキスト削減**: ツール定義の圧縮で50-75%のトークン削減
- **ツールフィルタリング**: 必要なツールのみを公開
- **名前空間管理**: ツール名衝突を回避するプレフィックス付与
- **複数MCP対応**: stdio型/HTTP(SSE)型の両方をサポート

## インストール

```bash
npm install
npm run build
```

## 使用方法

### 1. 設定ファイルの作成

`mcp-proxy.config.yaml`を作成:

```yaml
proxy:
  name: "mcp-proxy-gateway"
  version: "1.0.0"
  namespacing:
    enabled: true
    separator: "__"

upstreams:
  serena:
    type: stdio
    command: "uvx"
    args:
      - "--from"
      - "git+https://github.com/oraios/serena"
      - "serena"
      - "start-mcp-server"
    allowedTools:
      - find_symbol
      - get_symbols_overview
    toolDescriptionOverrides:
      find_symbol: "シンボル検索"

  deepwiki:
    type: http
    url: "https://mcp.deepwiki.com/mcp"
    allowedTools:
      - ask_question
```

### 2. Claude Codeとの統合

`.mcp.json`に追加:

```json
{
  "mcpServers": {
    "proxy": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/mcp-proxy/dist/index.js",
        "--config",
        "/path/to/mcp-proxy/mcp-proxy.config.yaml"
      ]
    }
  }
}
```

### 3. 実行

```bash
# 開発モード
npm run dev -- --config mcp-proxy.config.yaml

# 本番モード
npm start -- --config mcp-proxy.config.yaml
```

## 設定オプション

### proxy

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `name` | プロキシ名 | `mcp-proxy-gateway` |
| `version` | バージョン | `1.0.0` |
| `namespacing.enabled` | 名前空間を有効化 | `true` |
| `namespacing.separator` | 区切り文字 | `__` |

### upstreams

#### stdio型

```yaml
upstreams:
  example:
    type: stdio
    command: "npx"
    args: ["-y", "some-mcp-server"]
    env:
      API_KEY: "${API_KEY}"
    allowedTools:
      - tool1
      - tool2
    toolDescriptionOverrides:
      tool1: "カスタム説明"
```

#### HTTP(SSE)型

```yaml
upstreams:
  example:
    type: http
    url: "https://example.com/mcp"
    allowedTools:
      - tool1
    toolDescriptionOverrides:
      tool1: "カスタム説明"
```

## 環境変数

設定ファイル内で`${VAR}`または`${VAR:-default}`形式で環境変数を参照可能:

```yaml
env:
  PROJECT_PATH: "${PWD}"

upstreams:
  example:
    type: stdio
    command: "uvx"
    args: ["--project", "${PROJECT_PATH}"]
```

## アーキテクチャ

```
Claude Code -----> MCP Proxy Gateway -----> Upstream MCPs
              stdio                    stdio/http
                    +-------------+
                    |ToolRegistry | フィルタリング・圧縮
                    +-------------+
```

## ライセンス

MIT
