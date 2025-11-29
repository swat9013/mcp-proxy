# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## 作業の原則

- **意図を確認**: タスクの説明が曖昧な場合は、推測せずユーザーに確認する
- **目的から考える**: 機能や技術ではなく「なぜそれが必要か」から設計する
- **完了後の整理**: 実装後は自発的にリファクタリングとドキュメント更新を行う
- **批判的思考**: 自分の回答に対して「本当にこれで目的を達成できるか」を問う
- **修正→コミット**: 修正タスク完了後は自発的にコミットまで行う（ユーザーの追加指示を待たない）

## 設計原則

- **ゼロコンフィグ優先**: 設定オプションは最小限に。デフォルトで動作すべき
- **シンプルさ > 柔軟性**: カスタマイズ性より使いやすさを優先
- **ハードコード歓迎**: 変更頻度の低い値（名前、バージョン、区切り文字等）は設定化せずハードコード

## gitignore

以下は必ず`.gitignore`に含める：
- `.serena/` - Serena MCPツールのキャッシュ
- `.claude/` - Claude Code設定
- `node_modules/`, `dist/` - 依存関係・ビルド成果物

## ドキュメント

このリポジトリで作業する際は、必要に応じて以下のドキュメントを参照してください：

| ドキュメント | 内容 |
|-------------|------|
| `docs/architecture.md` | システム構成図、コンポーネント説明、データフロー |
| `docs/development.md` | 開発環境セットアップ、MCP SDK情報、よくある問題と対策 |
| `docs/configuration.md` | 設定ファイルの詳細仕様、オプション一覧 |

### ドキュメント整合性チェック

ドキュメントを修正する際は、以下を**一括で確認**すること：
- `README.md`
- `docs/` 配下すべて
- `CLAUDE.md`（このファイル自体も含む）

1つのドキュメントで問題を見つけたら、同様の問題が他にないか必ず確認する。

## プロジェクト概要

MCP Proxy Gatewayは、複数のMCPサーバーをラップし、ツール定義を圧縮してClaude Codeに公開するプロキシです。

## 技術スタック

- TypeScript (ES2022, NodeNext)
- MCP SDK (`@modelcontextprotocol/sdk`)
- Zod (設定バリデーション)
- yaml (設定ファイルパース)

## ディレクトリ構造

```
src/
├── index.ts              # エントリポイント（CLI引数パース）
├── server.ts             # ProxyServer（MCP Server実装）
├── config/
│   ├── schema.ts         # Zodスキーマ定義
│   └── loader.ts         # YAML読み込み・環境変数展開
├── upstream/
│   ├── types.ts          # UpstreamClientインターフェース
│   ├── stdio-client.ts   # stdio型MCPクライアント
│   ├── http-client.ts    # HTTP型MCPクライアント（Streamable HTTP）
│   └── manager.ts        # 複数クライアント管理
├── registry/
│   └── tool-registry.ts  # ツールフィルタリング・圧縮・名前空間
└── utils/
    └── logger.ts         # stderr出力ロガー

docs/
├── architecture.md       # アーキテクチャ詳細
├── development.md        # 開発ガイド
└── configuration.md      # 設定ファイル詳細
```

## 開発コマンド

```bash
npm run build    # TypeScriptビルド
npm run dev      # tsx で開発実行
npm start        # ビルド済みJSを実行
npm test         # vitest でテスト実行
```

## テスト方針

- テストはハッピーパス中心の**最小構成**を維持
- 小規模コードに対して過剰なテストケースを避ける
- 統合可能なテストは1つにまとめる
- エッジケースは必要な場合のみ追加

### 受け入れテスト

- **目的ベース**: 技術的な機能（ConfigLoader等）ではなく、ツールの「目的」（コンテキスト削減、フィルタリング等）でテストを設計する
- **E2Eで検証**: モックではなく実際のMCPサーバー（filesystem MCP等）を使用する
- **実装後は自発的にリファクタリング**: 重複コードはヘルパーに抽出し、ドキュメントも更新する

```bash
# テスト実行
npm test

# 単発実行（ウォッチモードなし）
npm test -- --run
```

## コーディング規約

- ESモジュール形式（`import/export`）を使用
- インポートには`.js`拡張子を付ける（`./config/loader.js`）
- ログはstderrに出力（stdioとの競合を避けるため）
- エラーハンドリングは呼び出し元に伝播させる

## 主要なデータフロー

1. `index.ts`: 設定ファイルパスを受け取り`ProxyServer`を起動
2. `ProxyServer`: `UpstreamManager`で上流MCPに接続
3. `ToolRegistry`: 上流から取得したツールをフィルタリング・圧縮
4. `tools/list`: 圧縮済みツール一覧を返却
5. `tools/call`: 名前空間を解決し、適切な上流MCPにルーティング

## テスト方法

```bash
# MCP Inspectorでtools/listをテスト
npx @modelcontextprotocol/inspector --cli --method tools/list \
  node dist/index.js -- --config mcp-proxy.test.yaml
```

## 設定ファイル

- `mcp-proxy.config.yaml`: 本番用設定（serena/deepwiki/atlassian/vibe_kanban）
- `mcp-proxy.test.yaml`: テスト用設定（filesystem）

## 実装上の注意点

### MCPトランスポートの種類

HTTP型MCPには2種類のトランスポートがある：
- **SSE (Server-Sent Events)**: 古い方式、現在は非推奨
- **Streamable HTTP**: 新しい標準方式（`StreamableHTTPClientTransport`を使用）

deepwikiなどの新しいMCPサーバーはStreamable HTTPを使用するため、`http-client.ts`では`StreamableHTTPClientTransport`を使用する。

### 耐障害性設計

- **部分的障害の許容**: 1つのupstreamが接続失敗しても、他のupstreamは正常に動作させる
- `manager.ts`の`connectAll()`では、失敗したupstreamをログに記録して継続する
- ツール呼び出し時に未接続のupstreamはスキップしてエラーメッセージを返す

### タイムアウト設計

- Claude CodeのMCP接続タイムアウトは約60秒
- **upstream接続タイムアウトは10秒以内**に設定（Claude Code側より短く）
- OAuth認証が必要なMCP（atlassianなど）はタイムアウトする可能性がある

### 環境変数展開の制約

`loader.ts`の環境変数展開：
- `${VAR}`: サポート
- `${VAR:-default}`: サポート（defaultは文字列リテラル）
- `${VAR:-${OTHER}}`: **未サポート**（ネストした変数展開は不可）

### 変更後の動作確認

コード変更後は必ず以下を実行：
```bash
npm run build
timeout 20 node dist/index.js --config mcp-proxy.config.yaml 2>&1 | grep -E "(Connected|Failed|upstreams|Gateway started)"
```

期待する出力：
- `Connected to X/Y upstreams`
- `MCP Proxy Gateway started`
