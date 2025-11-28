# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## ドキュメント

このリポジトリで作業する際は、必要に応じて以下のドキュメントを参照してください：

| ドキュメント | 内容 |
|-------------|------|
| `docs/architecture.md` | システム構成図、コンポーネント説明、データフロー |
| `docs/development.md` | 開発環境セットアップ、MCP SDK情報、よくある問題と対策 |
| `docs/configuration.md` | 設定ファイルの詳細仕様、オプション一覧 |

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
│   ├── http-client.ts    # HTTP(SSE)型MCPクライアント
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

- `mcp-proxy.config.yaml`: 本番用設定（serena/deepwiki/atlassian）
- `mcp-proxy.test.yaml`: テスト用設定（filesystem）
