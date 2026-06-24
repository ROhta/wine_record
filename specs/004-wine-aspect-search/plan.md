# 実装計画: 観点独立のワイン類似検索

**ブランチ**: `004-wine-aspect-search` | **日付**: 2026-06-24 | **仕様**: [spec.md](./spec.md)

**入力**: `/specs/004-wine-aspect-search/spec.md` の機能仕様

## 概要

記録済みワインに対し、外観・香り・味わいを自然文で表した条件で**観点ごとに独立した意味検索**を行い、
産地・ヴィンテージ・色は**構造的な絞り込み**（exact 一致・ベクトル距離で代替しない）として適用する
読み取り専用の MCP ツール `search_wines` を追加する（原則 IV の中核実装）。

技術的アプローチ（調査で確定。詳細は [research.md](./research.md)）:

- **観点別の意味検索**: 各観点 namespace（`appearance`/`aroma`/`taste`）を、その観点の表現テキストで
  独立に `query`（同一 index・同一埋め込み bge-m3 なのでコサインスコアは namespace 間で比較可能）。
- **構造的絞り込み（approach A）**: 観点クエリの候補 id を `overall` namespace から `fetch` してメタデータを
  ハイドレートし、**メモリ内で exact フィルタ**（color/産地階層/vintage）。候補 topK=`min(corpus, 1000)` のため
  corpus が上限以下なら観点ごとに全件取得＝取りこぼしなし。観点別 namespace の write 経路（001）は変えない。
- **合成順位（SC-002 の肝）**: 総合スコア = `Σ(wₐ·sₐ) / Σ(wₐ)`（クエリ指定の**全観点**で。欠損観点は sₐ=0
  だが重みは分母に残す）。これにより「両観点を満たすワイン > 片方のみ」が必ず成立する。
- **決定性（FR-011）**: スコアを固定精度に丸め、同点は wineId 昇順で安定ソート。
- **構造条件のみ（FR-012）**: `overall` を新メソッドで range 列挙 → メモリ内 exact フィルタ → wineId 順（意味順位なし）。

## 技術コンテキスト

**言語/バージョン**: TypeScript（Node.js 24・ESM・`@tsconfig/strictest`）。既存スタックに準拠

**主要な依存**: `@upstash/vector`（`query` data+topK / `range` 列挙）、`@modelcontextprotocol/sdk`、`zod`

**ストレージ**: Upstash Vector。`overall`（正本・全メタデータ）＋観点別 `appearance`/`aroma`/`taste`
（各表現テキストのみ・metadata は `{wineId}`）。埋め込みは bge-m3（dense・1024 次元）

**テスト**: vitest。注入可能なフェイク `VectorStore`（新メソッド含む）で env/ネットワーク非依存に
ランキング・合成・フィルタ・決定性を検証（原則 II）

**対象プラットフォーム**: リモート MCP サーバー（claude.ai コネクタ・読み取り専用ツール）

**プロジェクト種別**: MCP ツール（既存 `src/` に追加。`record_wine` 等と同じ依存注入パターン）

**性能目標**: SC-005 体感即時（数千件規模で 1 秒以内）

**制約**: 観点独立（FR-001・観点をまたいで表現を混ぜない）／構造は exact 一致（FR-004・原則 IV）／
読み取り専用（FR-010）／決定的（FR-011）

**規模/範囲**: 単一ユーザー・数千件（001 前提と一貫）。マルチユーザー・大規模はスコープ外

## 憲章チェック

*GATE: Phase 0 の調査前に通過しなければならない。Phase 1 の設計後に再チェックする。*

| 原則 | 評価 | 根拠 |
|---|---|---|
| I. MCP 契約の明確さ | ✅ 準拠 | 新ツール `search_wines` は入力/出力スキーマを明示・読み取り専用。自然文パースは接続先 LLM が担い、ツールは構造化入力を受ける（spec 前提） |
| II. テスト駆動 | ✅ **LIVE・厳守** | ロジック密（ランキング・合成・フィルタ・決定性）。**テスト先行**で書く。名指しのテストケース: SC-002（合成順位）・SC-003（構造 exact）・FR-001（観点独立）・FR-011/SC-006（決定性） |
| III. 厳格な型安全 | ✅ 準拠 | 入力（観点表現・構造条件・件数・重み）を境界で zod 検証→内部型。`any` 不使用 |
| IV. 意味的近さと構造的近さの分離 | ✅ **本機能が体現** | 観点近さ＝観点別 namespace の埋め込み検索／産地・ヴィンテージ・色＝メタデータの exact 一致・数値一致。**構造的近接をベクトル距離で代替しない** |
| V. 縦切り・YAGNI | ✅ 準拠 | MVP=US1（単一観点）で端から端まで。approach A を採用し、scale 用の B（観点 namespace への構造メタデータ付与＋再索引）は**作らない**（trigger 付き upgrade path として記録） |
| VI. インフラのコード化（IaC） | 該当なし | インフラ変更なし |
| セキュリティ | ✅ 準拠 | シークレットは env（既存）。検索は読み取り専用で副作用なし。入力は信頼境界外として検証 |

**設計後の再評価**: Phase 1 後も不変（新違反なし）。

## プロジェクト構成

### ドキュメント (この機能)

```text
specs/004-wine-aspect-search/
├── plan.md              # このファイル
├── research.md          # Phase 0（D1〜D8: approach A・合成式・決定性・FR-012・スコア比較性・topK・観点欠損・seam）
├── data-model.md        # Phase 1（SearchQuery / SearchResultItem / VectorStore 拡張）
├── quickstart.md        # Phase 1（US1〜US3 と SC を検証する手順）
├── contracts/
│   └── search-wines-tool.md   # Phase 1（search_wines の入出力契約＋検索セマンティクス）
└── tasks.md             # Phase 2（/speckit-tasks）
```

### ソースコード (リポジトリルート)

```text
src/
├── search/
│   ├── searchQuery.ts        # 新規: 入力検証・正規化（SearchQuery）。validateRecordInput と同じ流儀
│   ├── combineScores.ts      # 新規: 観点別スコアの合成（Σws/Σw・欠損=0）＋決定的ソート（純関数）
│   └── searchWines.ts        # 新規: 検索オーケストレーション（query×観点→fetch overall→filter→combine→rank）
├── storage/
│   └── vectorStore.ts        # 変更: scan(namespace) を追加（range 列挙・FR-012 用）。query/fetch は既存
├── tools/
│   └── searchWines.ts        # 新規: search_wines ツールハンドラ（createSearchWines）
└── server.ts                 # 変更: search_wines を registerTool

tests/
├── unit/
│   ├── combineScores.test.ts     # SC-002・FR-011（合成式・決定性）★先行
│   └── searchQuery.test.ts       # FR-009（境界検証）
├── integration/
│   └── searchWines.test.ts       # FR-001/004/012・SC-003（観点独立・構造 exact・構造のみ）★先行・フェイク store
└── fixtures/
    └── vectorStore.ts            # 変更: フェイクに scan を追加（seam パリティ）
```

**構造の決定**: 既存の「ドメイン純関数＋依存注入＋薄い MCP 層」を踏襲。検索ロジック（合成・ソート）は
純関数（`combineScores.ts`）に切り出して env 非依存で先行テスト。I/O は `VectorStore` 越し（フェイク注入）。

## 複雑さの追跡

> 憲章チェックに違反なし。記入不要。
