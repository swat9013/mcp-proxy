# ADR-0001: 実装言語としてTypeScriptを維持

## ステータス

採択（Accepted）

## コンテキスト

MCP Proxy Gatewayの実装言語について、Pythonや他の言語でリライトした場合にコードがシンプルになるか検討を行った。

### 現在の実装（TypeScript）

| 項目 | 値 |
|------|-----|
| 総行数 | 962行（ソース）+ 296行（テスト） |
| 依存関係 | 3個（MCP SDK, yaml, zod） |
| 主要モジュール | 10ファイル |

### 検討した選択肢

#### 1. Python

**メリット:**
- FastMCPフレームワークによるデコレータベースの簡潔な記述
- Pydanticによる設定バリデーションの簡素化
- 推定30%のコード削減（962行 → 600-700行）

**デメリット:**
- 動的プロキシパターンとの相性が悪い
  - このプロキシの本質は「上流から取得したツールを動的に公開」すること
  - FastMCPのデコレータ方式は静的定義向き
  - 低レベルServer APIを使う必要があり、簡素化メリットが減少
- subprocess管理（asyncio.subprocess）がやや複雑
- Claude CodeはNode.js環境で動作するため、追加のランタイム依存が発生

#### 2. Go

**メリット:**
- 単一バイナリ配布
- 高速起動
- 並行処理が言語レベルでサポート

**デメリット:**
- MCP SDK公式実装なし（プロトコル実装が必要）
- JSONスキーマ処理が冗長
- 推定1200-1400行（増加）

#### 3. Rust

**メリット:**
- 高性能
- メモリ安全性

**デメリット:**
- MCP SDK公式実装なし
- ボイラープレートが多い
- 推定1500-2000行（大幅増加）
- このユースケースにはオーバーエンジニアリング

#### 4. Deno/Bun

**メリット:**
- TypeScriptネイティブサポート
- 設定不要

**デメリット:**
- MCP SDKがNode.js向けに設計されており、互換性問題のリスク
- 既存コードをほぼそのまま使えるが、移行メリットが小さい

## 決定

**TypeScript（現状維持）** を選択する。

## 理由

1. **962行は十分シンプル**: Pythonで書き直しても600-700行程度であり、劇的な改善ではない

2. **動的ツール登録パターン**: このプロキシの本質は上流MCPサーバーから取得したツールを動的に公開すること。PythonのFastMCPはデコレータによる静的定義向きであり、動的登録には低レベルAPIが必要となるため、簡素化のメリットが薄れる

3. **エコシステム統一**: Claude CodeがNode.js環境で動作するため、TypeScriptの方が親和性が高い

4. **保守コスト**: 言語を変えると、将来のMCP SDK更新への追従が二重に必要になる

5. **公式SDKサポート**: TypeScript/JavaScript SDKは公式にメンテナンスされており、Go/Rustには公式SDKが存在しない

## 影響

- 現在のTypeScript実装を継続してメンテナンスする
- Python版MCP SDKの動向は引き続きウォッチし、動的ツール登録のサポートが改善された場合は再検討する

## 参考リンク

- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)

## 日付

2025-11-29
