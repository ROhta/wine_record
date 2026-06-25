---
description: "タスクリスト: 観点独立のワイン類似検索"
---

# タスク: 観点独立のワイン類似検索

**入力**: `/specs/004-wine-aspect-search/` の設計ドキュメント
**前提**: plan.md・spec.md（必須）、research.md・data-model.md・contracts/search-wines-tool.md・quickstart.md

**テスト**: spec §テスト＋憲章 原則 II（LIVE）により **TDD でテストを先に書く**。各ストーリーで「★先行」タスクを
実装タスクより前に置き、**まず失敗を確認**してから実装する。検証オラクルは contracts の C1〜C13。

## フォーマット: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可能（異なるファイル・依存なし）
- **[Story]**: US1/US2/US3（Setup/基盤/仕上げはラベルなし）

---

## Phase 1: セットアップ

**目的**: テストの足場。本機能は既存 `src/` に追加するため新規プロジェクト初期化は不要。

- [x] T001 [P] テスト用フェイク `VectorStore` を `tests/fixtures/vectorStore.ts` に整備/拡張する（namespace ごとに `query` 結果（id+score）と `fetch` メタデータを差し込めるように。後続の `scan` も見据える）

---

## Phase 2: 基盤（ブロッキングな前提条件）

**目的**: 全ストーリーが使う入力検証。これが無いとどのストーリーも検索を受け付けられない。

- [x] T002 [P] `tests/unit/searchQuery.test.ts` に検証テストを作成（FR-009: 観点も構造も全空→フィールド別エラー／`weights`≤0→エラー／`limit`<1→エラー／観点表現の trim／構造条件の正規化）★先行・失敗を確認
- [x] T003 `src/search/searchQuery.ts` を実装（SearchQuery の検証・正規化。001 の `normalizeRegion`/`normalizeVintage`/`parseWineColor`/`cleanOptionalString` と `FieldError` を再利用。重複実装しない）

**チェックポイント**: 入力検証が緑 → 各ストーリーの検索ロジックに進める

---

## Phase 3: ユーザーストーリー 1 - 単一観点で似たワインを探す（優先度: P1）🎯 MVP

**ゴール**: ひとつの観点表現で、その観点が意味的に近いワインを表示情報＋スコア付きで順位して返す。

**独立したテスト**: 味わい表現を渡し、味わいが近いワインが上位・各件に表示情報とスコアが付き、その観点を
持たないワインが出ないことを確認（フェイク store・env 非依存）。

### テスト（★先行）

- [x] T004 [P] [US1] `tests/unit/combineScores.test.ts` を作成（**SC-002**: 2観点とも 0.8 のワイン(score 0.8) > 味わいのみ 0.9 のワイン(score 0.45)／単一観点では素通し／**FR-011** 決定性: 同点は丸め＋`wineId` 昇順で安定／欠損観点は s=0 だが重みは分母に残す）★先行・失敗を確認
- [x] T005 [US1] `src/search/combineScores.ts` を実装（純関数。総合スコア `Σ(wₐ·sₐ)/Σ(wₐ)`（指定全観点・欠損 sₐ=0・重みは分母）＋ `(round(score,P) desc, wineId asc)` の決定的ソート）
- [x] T006 [P] [US1] `tests/integration/searchWines.test.ts` に単一観点の結合テストを作成（観点 namespace を `query`→候補 id を `overall` から `fetch` でハイドレート→表示情報＋スコア。**US1 シナリオ3**: その観点の表現を持たないワインは結果に出ない）★先行・フェイク store

### 実装

- [x] T007 [US1] `src/search/searchWines.ts` を実装（検索オーケストレーション: 指定された観点ごとに `query(namespace, {data, topK=min(corpus,1000)})`→候補 id を union→`fetch("overall", ids)` でハイドレート→`combineScores`→`limit` 件。SearchResultItem に表示情報を載せる。**読み取り専用**＝upsert/delete を呼ばない・FR-010）
- [x] T008 [US1] `src/tools/searchWines.ts` を実装（`createSearchWines` ハンドラ: 入力→`searchQuery` 検証→`searchWines`→テキスト＋`structuredContent` に整形。検証失敗は既存 `errorResult` を再利用）
- [x] T009 [US1] `src/server.ts` に `search_wines` を `registerTool`（入力スキーマ・description）し、`buildDeps` に `searchWines` 依存を配線する

**チェックポイント**: US1 完了 = 単一観点の観点別意味検索が端から端まで動く（MVP）

---

## Phase 4: ユーザーストーリー 2 - 複数観点を独立評価して合成（優先度: P2）

**ゴール**: 複数観点を同時指定し、各観点を独立に評価して観点別スコアを合成。重みと内訳スコアに対応。

**独立したテスト**: 外観＋味わいのクエリで両観点を満たすワインが片方のみより上位、内訳スコアが出る、
重みで順位が動く、観点をまたいで表現が混ざらないことを確認。

**依存**: US1（オーケストレーションと combineScores）。

### テスト（★先行）

- [x] T010 [P] [US2] `tests/integration/searchWines.test.ts` に複数観点ケースを追加（**SC-002** 統合: 両観点を満たすワイン > 片方のみ／**FR-001** 観点独立: 外観句は `appearance` namespace のみ・味わい句は `taste` のみに渡る（取り違えない）／**FR-006** 観点別内訳スコアが結果に出る／**FR-003** 重みで順位が動く）★先行・失敗を確認

### 実装

- [x] T011 [US2] `src/search/searchWines.ts` / `src/tools/searchWines.ts` / `src/server.ts` に `weights` 入力を配線して `combineScores` に渡し、各結果に観点別 `aspectScores` 内訳を含める（combineScores は T005 で重み対応済み）

**チェックポイント**: US1＋US2 = 観点独立検索の差別化価値が成立

---

## Phase 5: ユーザーストーリー 3 - 産地・ヴィンテージ・色で構造的に絞り込む（優先度: P3）

**ゴール**: 構造条件を exact 一致で絞り込み（ベクトル距離で代替しない）。構造のみクエリにも対応。

**独立したテスト**: color=red・country=スペインで結果が全件合致・条件外0件、構造のみで一覧が wineId 順・
スコアなしで返ることを確認。

**依存**: US1（ハイドレート済み候補に構造フィルタを足す）。

### テスト（★先行）

- [x] T012 [P] [US3] `tests/integration/searchWines.test.ts` に構造ケースを追加（**SC-003** color/region 階層/vintage の exact 一致・条件外の混入0件／**FR-012** 構造のみ（観点表現なし）は合致一覧を `wineId` 昇順・スコアなしで返す／空コーパス・合致ゼロは `items:[]`（エラーにしない・エッジ））★先行・失敗を確認

### 実装

- [x] T013 [US3] `src/storage/vectorStore.ts` の `VectorStore` interface に `scan(namespace): Promise<FetchedRecord[]>` を追加し、実装（Upstash `range({cursor,limit,includeMetadata})` を `nextCursor` 枯渇まで反復）。`tests/fixtures/vectorStore.ts` のフェイクにも `scan` を実装（seam パリティ・D8）
- [x] T014 [US3] `src/search/searchWines.ts` に構造フィルタを追加（ハイドレート済みメタデータに対し color/region 階層/vintage の **exact 一致**で候補を絞る・FR-004）。観点表現が無い構造のみクエリは `scan("overall")`→exact フィルタ→`wineId` 昇順で返す（FR-012）

**チェックポイント**: 全ユーザーストーリーが独立して機能

---

## Phase 6: 仕上げと横断的な関心事

- [x] T015 [P] `README.md` のツール表に `search_wines` を追記し、`src/server.ts` の description を最終調整する
- [x] T016 全ゲート（`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build`）が緑であることを確認する
- [x] T017 [quickstart.md](./quickstart.md) の自動ゲート（C1/C2/C4/C9/C11/C12）を実行して確認する（実機 SC-001/004/005 は手動・接続後）

---

## 依存関係と実行順序

- **Phase 1（Setup）** → **Phase 2（基盤: searchQuery）** → **Phase 3（US1）** → **Phase 4（US2）/ Phase 5（US3）** → **Phase 6（仕上げ）**
- **US1 (P1)**: 基盤後に開始。MVP。`combineScores`（T005）は `searchWines`（T007）の前。
- **US2 (P2) / US3 (P3)**: いずれも US1 の orchestration（T007）に依存。US2 と US3 は互いに独立（並列可）。
- 各ストーリー内: **テスト（★先行）→ 実装**（失敗を確認してから緑にする・原則 II）。

### 並列化の機会

- T001／T002／T004 は [P]（別ファイル）。
- US2（T010-T011）と US3（T012-T014）は US1 完了後に並列可。
- 同一ファイルを触るタスク（`searchWines.ts` を T007/T011/T014 が触る）は逐次。

## 実装戦略

### まず MVP（US1）

1. Setup（T001）→ 基盤（T002-T003: 検証）
2. US1（T004-T009）: combineScores（SC-002 を先に失敗テスト）→ searchWines → tool → server 配線
3. **停止して検証**: 単一観点検索が端から端まで動く（フェイクで結合テスト緑）。これが MVP
4. US2（複数観点＋重み）・US3（構造絞り込み＋scan）を順に追加

### TDD 規律（原則 II）

- 各ストーリーの「★先行」テストを**まず書いて失敗させ**、それから実装で緑にする。
- 特に `combineScores` の **SC-002**（2観点>1観点）と **FR-011**（決定性）、`searchWines` の **FR-001**（観点独立）・
  **SC-003**（構造 exact）・**FR-012**（構造のみ）は、contracts の C1〜C13 を検証可能なテストに落とす。

## メモ

- 検索ロジック（合成・ソート）は純関数（`combineScores.ts`）に切り出し、I/O は注入 `VectorStore`（フェイク）で
  env/ネットワーク非依存に検証する（既存 `record_wine` 等と同じ依存注入パターン）。
- 各タスク／論理単位ごとにコミットする。
