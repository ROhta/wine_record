---
description: "Task list for record-wine feature implementation"
---

# Tasks: ワインの記録（ラベル写真からの登録）

**Input**: Design documents from `/specs/001-record-wine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 含む（spec の Testing 節 + 憲章 II Test-First に基づき TDD）

**Organization**: ユーザーストーリー単位。各ストーリーは独立してテスト可能な増分。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可（別ファイル・未完タスクに依存しない）
- **[Story]**: US1 / US2 / US3
- ファイルパスを明記

## Path Conventions

単一 TypeScript プロジェクト。`src/`, `tests/`, `data/` をリポジトリ直下に置く（plan.md 準拠）。

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Node.js 24 / TypeScript プロジェクトを初期化（`package.json`, `tsconfig.json` は `@tsconfig/strictest` 継承）
- [ ] T002 [P] Vitest を設定（`vitest.config.ts`、`npm test` スクリプト）
- [ ] T003 [P] Lint / Format を設定（ESLint + Prettier、`any` 禁止ルール）
- [ ] T004 [P] `src/`, `tests/{contract,integration,unit}`, `data/`, `src/widgets/` のディレクトリ構造を作成（plan.md の構造）
- [ ] T005 [P] `.env.example` を作成し、`.gitignore` に `.env` を追加（Upstash / ストレージのキー欄）

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ これらが完了するまでユーザーストーリー実装は開始できない**

- [ ] T006 [P] 環境変数の読込・検証を実装 `src/config.ts`（必須キー欠落で起動失敗、値はログに出さない）
- [ ] T007 [P] ドメイン型を定義 `src/domain/wineRecord.ts` / `src/domain/region.ts` / `src/domain/taxonomy.ts`（data-model.md 準拠）
- [ ] T008 [P] Upstash Vector ラッパの骨組みを実装 `src/storage/vectorStore.ts`（`bge-m3` インデックス前提、namespace=overall/aroma/appearance/taste の upsert/fetch I/F）
- [ ] T009 [P] MCP サーバー骨組みを実装 `src/server.ts`（Streamable HTTP、Helmet 系セキュアヘッダ既定適用、ツール登録の土台）
- [ ] T010 **前提データ**: 提供される JSA 表現集 PDF を構造化し `data/jsa-taxonomy.json` を生成（外観/香り/味わい→ターム配列。`pdf` スキルで対応）
- [ ] T011 [P] JSA タクソノミーのローダ/型検証を実装 `src/domain/taxonomy.ts`（`data/jsa-taxonomy.json` を読み込み、カテゴリ別タームを提供）

**Checkpoint**: 土台完成。ユーザーストーリー実装を開始できる。

---

## Phase 3: User Story 1 - ラベル写真から記録の下書きを作って保存する (Priority: P1) 🎯 MVP

**Goal**: 基本情報（名前/生産者/産地/年/輸入業者）を確認・修正して永続化できる。

**Independent Test**: 写真1枚→確認画面に事前入力→修正して承認→保存後に取得して一致。

### Tests for User Story 1 (TDD: 先に書いて失敗させる) ⚠️

- [ ] T012 [P] [US1] `record_wine` の契約テスト `tests/contract/recordWine.test.ts`（contracts/mcp-tools.md の入出力・必須/任意・name 非空）
- [ ] T013 [P] [US1] WineRecord バリデーションのユニットテスト `tests/unit/wineRecord.test.ts`（name 非空 / vintage number|"NV"|null / imageUrl ドメイン制約）
- [ ] T014 [P] [US1] 記録フロー結合テスト `tests/integration/recordCore.test.ts`（承認で保存・未承認で非永続化＝SC-005）

### Implementation for User Story 1

- [ ] T015 [P] [US1] WineRecord のバリデーション/正規化を実装 `src/domain/wineRecord.ts`
- [ ] T016 [P] [US1] RegionPath の構築/正規化を実装 `src/domain/region.ts`
- [ ] T017 [US1] `vectorStore` の `overall` namespace への upsert を実装 `src/storage/vectorStore.ts`（T008 を具体化）
- [ ] T018 [US1] `record_wine` ツールを実装 `src/tools/recordWine.ts`（入力検証→保存→`{wineId, recordedAt}`、明示承認前提）
- [ ] T019 [US1] 確認ウィジェット（最小）を実装 `src/widgets/confirmRecord/`（抽出値の事前入力・修正・承認。MCP Apps リソース）
- [ ] T020 [US1] `record_wine` をサーバーに登録し結線 `src/server.ts`

**Checkpoint**: US1 が単体で動作・テスト可能（MVP）。

---

## Phase 4: User Story 2 - 外観・香り・味わいを定義済み語彙からタップ選択する (Priority: P2)

**Goal**: JSA 語彙からタップ選択した表現を記録に付与できる（自由入力なし）。

**Independent Test**: 語彙が3カテゴリで提示→複数タップ→記録反映、自由入力手段が無い。

### Tests for User Story 2 (TDD) ⚠️

- [ ] T021 [P] [US2] `get_jsa_taxonomy` の契約テスト `tests/contract/getJsaTaxonomy.test.ts`（全件 / category 指定）
- [ ] T022 [P] [US2] 表現バリデーションのユニットテスト `tests/unit/expressionTerms.test.ts`（語彙外の値を拒否＝FR-005/原則I）
- [ ] T023 [P] [US2] 表現選択の結合テスト `tests/integration/expressions.test.ts`（タップ選択が記録に反映）

### Implementation for User Story 2

- [ ] T024 [US2] `get_jsa_taxonomy` ツールを実装 `src/tools/getJsaTaxonomy.ts`（T011 のローダを利用）
- [ ] T025 [US2] `record_wine` に表現タグの語彙内検証を追加 `src/tools/recordWine.ts` / `src/domain/wineRecord.ts`
- [ ] T026 [US2] `vectorStore` の `aroma`/`appearance`/`taste` namespace upsert を実装 `src/storage/vectorStore.ts`（未選択カテゴリはスキップ）
- [ ] T027 [US2] 確認ウィジェットにタップ選択 UI を追加 `src/widgets/confirmRecord/`（カテゴリ別チップ、文字入力手段なし）
- [ ] T028 [US2] `get_jsa_taxonomy` をサーバーに登録 `src/server.ts`

**Checkpoint**: US1 + US2 が独立に動作。

---

## Phase 5: User Story 3 - ラベル画像を永続保存して見返す (Priority: P3)

**Goal**: ラベル画像をオブジェクトストレージに保存し、URL で参照できる。

**Independent Test**: 署名URL取得→直接アップロード→imageUrl付きで保存→後で画像取得。

### Tests for User Story 3 (TDD) ⚠️

- [ ] T029 [P] [US3] `get_upload_url` の契約テスト `tests/contract/getUploadUrl.test.ts`（contentType検証・短命URL・imageUrl返却）
- [ ] T030 [P] [US3] 画像永続化の結合テスト `tests/integration/imagePersist.test.ts`（保存→取得、アップロード失敗時は基本記録成立＋画像欠落通知）

### Implementation for User Story 3

- [ ] T031 [P] [US3] オブジェクトストレージ・ラッパを実装 `src/storage/imageStore.ts`（R2 既定、署名付きPUT URL 発行・参照URL生成）
- [ ] T032 [US3] `get_upload_url` ツールを実装 `src/tools/getUploadUrl.ts`（短命・単一用途）
- [ ] T033 [US3] `record_wine` の `imageUrl` を自ストレージ https のみ許可するよう検証強化 `src/tools/recordWine.ts`
- [ ] T034 [US3] 確認ウィジェットにファイル選択→直接アップロードを追加 `src/widgets/confirmRecord/`
- [ ] T035 [US3] 画像保存失敗時のフォールバック（基本記録は成立、欠落通知）を実装 `src/tools/recordWine.ts`
- [ ] T036 [US3] `get_upload_url` をサーバーに登録 `src/server.ts`

**Checkpoint**: 全ユーザーストーリーが独立に動作。

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T037 [P] README と `.env.example` を最新化 `README.md`
- [ ] T038 [P] セキュリティ・ハードニング（Helmet 設定確認・署名URL短命・エラーに秘匿情報を出さない）
- [ ] T039 quickstart.md の検証シナリオを手動実行（Claude モバイルで端から端）
- [ ] T040 Codex モバイルでの画像受け渡し・アップロード挙動を検証し差分を記録（R5 リスク）
- [ ] T041 [P] エッジケースの追加ユニットテスト `tests/unit/`（部分抽出 / NV / 画像欠落）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: 依存なし。
- **Foundational (P2)**: Setup 完了後。全ストーリーをブロック。特に T010（JSA データ）は US2 の前提。
- **User Stories (P3+)**: Foundational 完了後。優先度順 P1→P2→P3、または独立に並行可能。
- **Polish (P6)**: 対象ストーリー完了後。

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始可。他ストーリーに依存しない（MVP）。
- **US2 (P2)**: Foundational + T010 後。US1 の記録に表現を追加する形だが、独立にテスト可能。
- **US3 (P3)**: Foundational 後。US1 の記録に画像を紐づけるが、独立にテスト可能。

### Within Each User Story

- テストを先に書き、失敗を確認してから実装（憲章 II）。
- 型/ドメイン → ストレージ → ツール → ウィジェット → サーバー登録 の順。

### Parallel Opportunities

- Setup の [P] タスク（T002–T005）は並行可。
- Foundational の [P] タスク（T006–T009, T011）は並行可（T010 はデータ受領待ち）。
- 各ストーリーの [P] テスト（T012–T014 等）は並行可。
- Foundational 完了後、US1/US2/US3 は別担当で並行可能。

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1。
2. **STOP & VALIDATE**: US1 を単体検証（記録の保存・取得・承認ゲート）。
3. ここまでで「飲んだワインを記録できる」最小アプリが成立。

### Incremental Delivery

1. Setup + Foundational → 土台。
2. US1（基本記録, MVP）→ 検証 → デモ。
3. US2（JSA タップ選択）→ 検証 → デモ。
4. US3（ラベル画像の永続化）→ 検証 → デモ。

---

## Notes

- [P] = 別ファイル・依存なし。
- [Story] ラベルでトレーサビリティを確保。
- テストは実装前に失敗を確認。
- 各タスク / 論理単位ごとにコミット（憲章 Development Workflow）。
- 検索・観点別提示は本スコープ外（次スコープ）。ただし保存時に namespace 構造と
  産地階層・年メタデータを正しく書くことで、その前提を満たす（原則 IV）。
