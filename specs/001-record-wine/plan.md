# Implementation Plan: ワインの記録（ラベル写真からの登録）

**Branch**: `001-record-wine` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-record-wine/spec.md`

## Summary

ラベル写真から飲んだワインを記録する縦切り機能。接続先 LLM（Claude / Codex モバイル）の
vision がラベルの文字を読み、リモート MCP サーバーが「確認 UI（MCP Apps ウィジェット）の
描画」「JSA 表現タクソノミーの供給」「Upstash Vector への構造化保存」「ラベル画像の
オブジェクトストレージ永続化」を担う。技術的詳細は
[設計ドキュメント](../../docs/superpowers/specs/2026-06-17-wine-record-design.md) を参照。

## Technical Context

**Language/Version**: TypeScript (Node.js 24), `@tsconfig/strictest`

**Primary Dependencies**: MCP TypeScript SDK（Streamable HTTP リモート + MCP Apps ウィジェット）、
`@upstash/vector`、オブジェクトストレージ SDK（Cloudflare R2 / Vercel Blob のいずれか）、
HTTP セキュアヘッダ（Helmet 系）

**Storage**:
- Upstash Vector（記録の構造化保存・埋め込み。組み込みモデル `BAAI/bge-m3` で多言語=日本語対応）
- オブジェクトストレージ（ラベル画像本体。Vector には URL のみ保持）

**Testing**: Vitest（ユニット/契約）。TDD（憲章 II）。

**Target Platform**: Linux サーバー上のリモート MCP サーバー（Streamable HTTP）。
クライアントは Claude / Codex モバイルアプリ。

**Project Type**: web-service（リモート MCP サーバー、UI ウィジェット同梱）

**Performance Goals**: 個人スケール。記録 1 件の保存応答は数百 ms 目安。

**Constraints**: Upstash 無料枠内（数千〜1万ベクトル目安、1バッチ最大1000ベクトル）。
シークレットは環境変数管理。署名付き URL は短命。

**Scale/Scope**: 単一ユーザー、数千件の記録。本スコープは記録フローのみ。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | ゲート | 判定 |
|---|---|---|
| I. MCP-First Contract Clarity | 各ツールに入力/出力スキーマ・副作用を明記（contracts/ で定義）| PASS（Phase 1 で契約定義）|
| II. Test-First | spec の Testing 節でテストを要求済み。tasks にテスト先行を含める | PASS |
| III. Strict Type Safety | `@tsconfig/strictest`、境界での型検証、`any` 禁止 | PASS |
| IV. Semantic vs Structured Separation | 本スコープは記録（保存）のみ。データモデルで意味的/構造的フィールドを分離設計し、検索の前提を満たす | PASS（保存側で分離可能な形に） |
| V. Vertical-Slice & YAGNI | 記録フローを端から端まで。検索 UI は作らない | PASS |

**初期判定**: 違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-record-wine/
├── plan.md              # 本ファイル
├── research.md          # Phase 0 出力
├── data-model.md        # Phase 1 出力
├── quickstart.md        # Phase 1 出力
├── contracts/           # Phase 1 出力（MCP ツール契約）
└── tasks.md             # /speckit-tasks で生成
```

### Source Code (repository root)

```text
src/
├── server.ts                 # MCP サーバー起動（Streamable HTTP, セキュアヘッダ）
├── tools/
│   ├── getJsaTaxonomy.ts     # 表現語彙の供給
│   ├── getUploadUrl.ts       # ラベル画像の署名付きアップロード URL 発行
│   └── recordWine.ts         # 記録の確定保存（Vector へ upsert）
├── domain/
│   ├── wineRecord.ts         # WineRecord 型・バリデーション・正規化
│   ├── region.ts             # 産地階層（country/region/subregion/commune）
│   └── taxonomy.ts           # JSA タクソノミー型・ローダ
├── storage/
│   ├── vectorStore.ts        # Upstash Vector ラッパ（namespace 構造）
│   └── imageStore.ts         # オブジェクトストレージラッパ（署名 URL/参照）
├── widgets/
│   └── confirmRecord/        # 確認 + タップ選択 UI（MCP Apps リソース）
└── config.ts                 # 環境変数の読込・検証

tests/
├── contract/                 # MCP ツール契約テスト
├── integration/              # 記録フローの結合テスト
└── unit/                     # ドメインロジックのユニットテスト

data/
└── jsa-taxonomy.json         # JSA 表現の構造化データ（前提タスクで生成）
```

**Structure Decision**: 単一 TypeScript プロジェクト（web-service）。MCP ツールは
`tools/`、ドメインロジックは `domain/`、外部 I/O は `storage/`、UI は `widgets/` に分離し、
原則 I（契約の明確さ）と III（型安全）を構造で担保する。

## Complexity Tracking

> 違反なし。記載不要。
