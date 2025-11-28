# 設定ファイル詳細

## 基本構造

```yaml
proxy:
  name: "mcp-proxy-gateway"
  version: "1.0.0"
  namespacing:
    enabled: true
    separator: "__"

upstreams:
  upstream-name:
    type: stdio | http
    # ... 各タイプ固有の設定

env:
  VAR_NAME: "value"
```

## proxy セクション

| オプション | 型 | デフォルト | 説明 |
|-----------|---|-----------|------|
| `name` | string | `mcp-proxy-gateway` | プロキシの名前（MCPプロトコルで使用） |
| `version` | string | `1.0.0` | プロキシのバージョン |
| `namespacing.enabled` | boolean | `true` | ツール名に名前空間プレフィックスを付与 |
| `namespacing.separator` | string | `__` | 名前空間の区切り文字 |

### 名前空間の例

`namespacing.enabled: true`, `separator: "__"` の場合：

```
元のツール名: find_symbol
上流名: serena
→ 公開ツール名: serena__find_symbol
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
    toolDescriptionOverrides:
      find_symbol: "シンボル検索"
```

| オプション | 型 | 必須 | 説明 |
|-----------|---|-----|------|
| `type` | `"stdio"` | Yes | 接続タイプ |
| `command` | string | Yes | 実行コマンド |
| `args` | string[] | No | コマンド引数 |
| `env` | Record<string, string> | No | 環境変数 |
| `allowedTools` | string[] | No | 公開するツール（未指定時は全ツール） |
| `toolDescriptionOverrides` | Record<string, string> | No | ツール説明の上書き |

### http型

HTTP(SSE)でMCPサーバーに接続。

```yaml
upstreams:
  deepwiki:
    type: http
    url: "https://mcp.deepwiki.com/mcp"
    allowedTools:
      - ask_question
    toolDescriptionOverrides:
      ask_question: "リポジトリについて質問"
```

| オプション | 型 | 必須 | 説明 |
|-----------|---|-----|------|
| `type` | `"http"` | Yes | 接続タイプ |
| `url` | string (URL) | Yes | MCPサーバーのURL |
| `allowedTools` | string[] | No | 公開するツール |
| `toolDescriptionOverrides` | Record<string, string> | No | ツール説明の上書き |

## env セクション

グローバル環境変数を定義。設定ファイル内の他の場所で `${VAR}` として参照可能。

```yaml
env:
  PROJECT_PATH: "${PWD}"
  API_KEY: "${MY_API_KEY:-default_key}"
```

### 環境変数の展開形式

| 形式 | 説明 |
|------|------|
| `${VAR}` | 環境変数VARの値（未定義時は空文字） |
| `${VAR:-default}` | 環境変数VARの値（未定義時はdefault） |

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

## ツール説明の圧縮

### 自動圧縮

説明文は自動的に圧縮されます：
- 最初の文のみを使用
- 最大100文字に制限
- inputSchemaからdescription/titleフィールドを削除

### カスタム説明

`toolDescriptionOverrides` でツールごとにカスタム説明を設定可能：

```yaml
toolDescriptionOverrides:
  find_symbol: "シンボル検索"
  replace_symbol_body: "シンボルの内容を置換"
  get_symbols_overview: "ファイル内のシンボル一覧を取得"
```

## 完全な設定例

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
      - "--context"
      - "ide-assistant"
      - "--project"
      - "${PROJECT_PATH}"
    allowedTools:
      - get_symbols_overview
      - find_symbol
      - replace_symbol_body
    toolDescriptionOverrides:
      find_symbol: "シンボル検索"
      replace_symbol_body: "シンボル編集"

  deepwiki:
    type: http
    url: "https://mcp.deepwiki.com/mcp"
    allowedTools:
      - ask_question
    toolDescriptionOverrides:
      ask_question: "GitHubリポジトリについて質問"

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
    toolDescriptionOverrides:
      getJiraIssue: "Jira課題取得"
      searchJiraIssuesUsingJql: "JQL検索"

env:
  PROJECT_PATH: "${PWD}"
```
