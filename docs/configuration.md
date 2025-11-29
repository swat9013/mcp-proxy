# 設定ファイル詳細

## 基本構造

```yaml
upstreams:
  upstream-name:
    type: stdio | http
    # ... 各タイプ固有の設定
```

## upstreams セクション

### stdio型

子プロセスとしてMCPサーバーを起動し、stdin/stdoutで通信。

```yaml
upstreams:
  serena:
    type: stdio
    command: "uvx"
    args:
      - "--from"
      - "git+https://github.com/oraios/serena"
      - "serena"
      - "start-mcp-server"
      - "--project"
      - "${PROJECT_PATH}"
    env:
      SOME_VAR: "value"
    allowedTools:
      - find_symbol
      - get_symbols_overview
```

| オプション | 型 | 必須 | 説明 |
|-----------|---|-----|------|
| `type` | `"stdio"` | Yes | 接続タイプ |
| `command` | string | Yes | 実行コマンド |
| `args` | string[] | No | コマンド引数 |
| `env` | Record<string, string> | No | 環境変数 |
| `allowedTools` | string[] | No | 公開するツール（未指定時は全ツール） |

### http型

HTTP(SSE)でMCPサーバーに接続。

```yaml
upstreams:
  deepwiki:
    type: http
    url: "https://mcp.deepwiki.com/mcp"
    allowedTools:
      - ask_question
```

| オプション | 型 | 必須 | 説明 |
|-----------|---|-----|------|
| `type` | `"http"` | Yes | 接続タイプ |
| `url` | string (URL) | Yes | MCPサーバーのURL |
| `allowedTools` | string[] | No | 公開するツール |

## 環境変数の展開

設定ファイル内で `${VAR}` 形式の環境変数展開をサポート。

| 形式 | 説明 |
|------|------|
| `${VAR}` | 環境変数VARの値（未定義時は空文字） |
| `${VAR:-default}` | 環境変数VARの値（未定義時はdefault） |

## 名前空間

ツール名には自動的に上流名がプレフィックスとして付与されます（区切り文字: `__`）。

```
元のツール名: find_symbol
上流名: serena
→ 公開ツール名: serena__find_symbol
```

## ツールフィルタリング

`allowedTools` を指定すると、そのリストに含まれるツールのみが公開されます。

```yaml
upstreams:
  serena:
    type: stdio
    command: "uvx"
    args: ["serena"]
    # 20個のツールから10個に絞り込み
    allowedTools:
      - get_symbols_overview
      - find_symbol
      - find_referencing_symbols
      - replace_symbol_body
      - insert_after_symbol
      - insert_before_symbol
      - rename_symbol
      - search_for_pattern
      - list_dir
      - find_file
```

## ツール説明の自動圧縮

説明文は自動的に圧縮されます：
- 最初の文のみを使用
- 最大100文字に制限
- inputSchemaからdescription/titleフィールドを削除

## 完全な設定例

```yaml
upstreams:
  serena:
    type: stdio
    command: "uvx"
    args:
      - "--from"
      - "git+https://github.com/oraios/serena"
      - "serena"
      - "start-mcp-server"
      - "--context"
      - "ide-assistant"
      - "--project"
      - "${PROJECT_PATH:-${PWD}}"
    allowedTools:
      - get_symbols_overview
      - find_symbol
      - replace_symbol_body

  deepwiki:
    type: http
    url: "https://mcp.deepwiki.com/mcp"
    allowedTools:
      - ask_question

  atlassian:
    type: stdio
    command: "npx"
    args:
      - "-y"
      - "mcp-remote"
      - "https://mcp.atlassian.com/v1/sse"
    allowedTools:
      - getJiraIssue
      - searchJiraIssuesUsingJql
```
