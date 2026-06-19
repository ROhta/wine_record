---
description: "record-wine 機能の実装タスク一覧"
---

# タスク: ワインの記録（ラベル写真からの登録）

**入力**: 設計ドキュメント `/specs/001-record-wine/`

**前提**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**テスト**: 含む（spec のテスト節 + 憲章 II テスト駆動に基づき TDD）

**構成方針**: ユーザーストーリー単位。各ストーリーは独立してテスト可能な増分。

## 形式: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可（別ファイル・未完タスクに依存しない）
- **[Story]**: US1 / US2 / US3
- ファイルパスを明記

## パス規約

単一 TypeScript プロジェクト。`src/`, `tests/`, `data/` をリポジトリ直下に置く（plan.md 準拠）。

---

## フェーズ1: セットアップ（共有基盤）

- [X] T001 Node.js 24 / TypeScript プロジェクトを初期化（`package.json`, `tsconfig.json` は `@tsconfig/strictest` 継承）
- [X] T002 [P] Vitest を設定（`vitest.config.ts`、`npm test` スクリプト）
- [X] T003 [P] Lint / Format を設定（ESLint + Prettier、`any` 禁止ルール）
- [X] T004 [P] `src/`, `tests/{contract,integration,unit}`, `data/`, `src/widgets/` のディレクトリ構造を作成（plan.md の構造）
- [X] T005 [P] `.env.example` を作成し、`.gitignore` に `.env` を追加（Upstash / ストレージのキー欄）

---

## フェーズ2: 基盤（ブロッキング前提）

**⚠️ これらが完了するまでユーザーストーリー実装は開始できない**

- [X] T006 [P] 環境変数の読込・検証を実装 `src/config.ts`（必須キー欠落で起動失敗、値はログに出さない）
- [X] T007 [P] ドメイン型を定義 `src/domain/wineRecord.ts` / `src/domain/region.ts` / `src/domain/taxonomy.ts`（data-model.md 準拠）
- [X] T008 [P] Upstash Vector ラッパの骨組みを実装 `src/storage/vectorStore.ts`（`bge-m3` インデックス前提、namespace=overall/aroma/appearance/taste の upsert/fetch I/F）
- [X] T009 [P] MCP サーバー骨組みを実装 `src/server.ts`（Streamable HTTP、Helmet 系セキュアヘッダ既定適用、ツール登録の土台）
- [X] T010 **前提データ**: 提供される JSA 表現集 PDF を構造化し `data/jsa-taxonomy.json` を生成（外観/香り/味わい→ターム配列。`pdf` スキルで対応）
- [X] T011 [P] JSA タクソノミーのローダ/型検証を実装 `src/domain/taxonomy.ts`（`tests/fixtures` の小サンプルでテストし、T010 と並行可）

**チェックポイント**: 土台完成。

---

## フェーズ3: デリスク・スパイク（US1 の前に最重要の未知数を殺す）🔬

**目的**: 本機能固有の未検証経路を、捨ててよい最小コードで先に検証する（憲章 V）。
ここで制約が判明したら、ツール/UI を作り込む前に設計を見直す。スパイクのコードは破棄してよい。

- [ ] T012 [SPIKE] 画像アップロード経路の最小検証: 最小ウィジェットで写真選択 → `get_upload_url` 相当の署名付き PUT URL へ直接アップロード → 取得用 URL で再取得できることを **Claude モバイル**で確認 `spikes/image-upload/`
- [X] T013 [SPIKE] vision OCR 経路の確認: ラベル画像が接続先 LLM の vision に渡り、文字情報を抽出できることを Claude モバイルで確認（抽出値→ツール入力に渡せる形か）`spikes/vision-ocr/`
- [X] T014 [SPIKE] Upstash 無料枠の確認: hosted 埋め込み（`openai/text-embedding-3-small`。当初の `BAAI/bge-m3` はコンソール提供終了→research.md R1）でインデックスを作成し namespace 付き upsert/query/fetch が無料枠で可能かを確認 `spikes/upstash-index/`

**チェックポイント**: 画像パス・vision・無料枠インデックス形が確認できた。US1 実装に進める。
（重大な制約が出たら plan.md / research.md を更新してから先へ。）

---

## フェーズ4: ユーザーストーリー1 - ラベル写真から記録の下書きを作って保存する（優先度: P1）🎯 MVP

**ゴール**: 基本情報（名前/生産者/産地/年/輸入業者）を確認・修正して永続化できる。

**独立したテスト**: 写真1枚→確認画面に事前入力→修正して承認→保存後に取得して一致。

### ユーザーストーリー1 のテスト（TDD: 先に書いて失敗させる）⚠️

- [X] T015 [P] [US1] `record_wine` の契約テスト `tests/contract/recordWine.test.ts`（contracts/mcp-tools.md の入出力・必須/任意・name 非空）
- [X] T016 [P] [US1] WineRecord バリデーションのユニットテスト `tests/unit/wineRecord.test.ts`（name 非空 / vintage number|"NV"|null / imageUrl ドメイン制約）
- [X] T017 [P] [US1] 記録フロー結合テスト `tests/integration/recordCore.test.ts`（承認で保存・未承認で非永続化＝SC-005）

### ユーザーストーリー1 の実装

- [X] T018 [P] [US1] WineRecord のバリデーション/正規化を実装 `src/domain/wineRecord.ts`
- [X] T019 [P] [US1] RegionPath の構築/正規化を実装 `src/domain/region.ts`
- [X] T020 [US1] `vectorStore` の `overall` namespace への upsert を実装 `src/storage/vectorStore.ts`（T008 を具体化）
- [X] T021 [US1] `record_wine` ツールを実装 `src/tools/recordWine.ts`（入力検証→保存→`{wineId, recordedAt}`、明示承認前提）
- [X] T022a [SPIKE] [US1] 描画検証（結論）: リモート Streamable-HTTP（claude.ai/モバイル）では MCP Apps ウィジェットが描画されない（"No approval received"）。stdio/デスクトップでは可（bingo_mcp 前例＝差分はトランスポート）。elicitation も claude.ai 未対応（#153）。→ **テキスト確認フローへ転換**。`spikes/widget-render/`・research.md R5
- [X] T022b [P] [US1] `preview_record` の契約テスト `tests/contract/previewRecord.test.ts`（下書き→正規化サマリ＋structuredContent、副作用なし、検証エラーのフィールド別提示）
- [X] T022c [US1] `preview_record` ツールを実装 `src/tools/previewRecord.ts`（下書きを正規化・検証し、保存される内容をテキスト＋structuredContent で返す。保存しない）
- [X] T022 [US1] テキスト確認フロー結線: `preview_record` をサーバー登録 + `record_wine` の description を「ユーザーの明示承認後にのみ呼ぶ」に強化 `src/server.ts`
- [X] T023 [US1] `record_wine` をサーバーに登録し結線 `src/server.ts`

**チェックポイント**: US1 が単体で動作・テスト可能（MVP）。

---

## フェーズ5: ユーザーストーリー2 - 外観・香り・味わいを定義済み語彙からタップ選択する（優先度: P2）

**ゴール**: JSA 語彙からタップ選択した表現を記録に付与できる（自由入力なし）。

**独立したテスト**: 語彙が3カテゴリで提示→複数タップ→記録反映、自由入力手段が無い。

### ユーザーストーリー2 のテスト（TDD）⚠️

- [ ] T024 [P] [US2] `get_jsa_taxonomy` の契約テスト `tests/contract/getJsaTaxonomy.test.ts`（全件 / category 指定）
- [ ] T025 [P] [US2] 表現バリデーションのユニットテスト `tests/unit/expressionTerms.test.ts`（語彙外の値を拒否＝FR-005/原則I）
- [ ] T026 [P] [US2] 表現選択の結合テスト `tests/integration/expressions.test.ts`（タップ選択が記録に反映）

### ユーザーストーリー2 の実装

- [ ] T027 [US2] `get_jsa_taxonomy` ツールを実装 `src/tools/getJsaTaxonomy.ts`（T011 のローダを利用）
- [ ] T028 [US2] `record_wine` に表現タグの語彙内検証を追加 `src/tools/recordWine.ts` / `src/domain/wineRecord.ts`
- [ ] T029 [US2] `vectorStore` の `aroma`/`appearance`/`taste` namespace upsert を実装 `src/storage/vectorStore.ts`（未選択カテゴリはスキップ）
- [ ] T030 [US2] 確認ウィジェットにタップ選択 UI を追加 `src/widgets/confirmRecord/`（カテゴリ別チップ、文字入力手段なし）
- [ ] T031 [US2] `get_jsa_taxonomy` をサーバーに登録 `src/server.ts`

**チェックポイント**: US1 + US2 が独立に動作。

---

## フェーズ6: ユーザーストーリー3 - ラベル画像を永続保存して見返す（優先度: P3）

**ゴール**: ラベル画像をオブジェクトストレージに保存し、URL で参照できる。

**独立したテスト**: 署名URL取得→直接アップロード→imageUrl付きで保存→後で画像取得。

### ユーザーストーリー3 のテスト（TDD）⚠️

- [ ] T032 [P] [US3] `get_upload_url` の契約テスト `tests/contract/getUploadUrl.test.ts`（contentType検証・短命URL・imageUrl返却）
- [ ] T033 [P] [US3] 画像永続化の結合テスト `tests/integration/imagePersist.test.ts`（保存→取得、アップロード失敗時は基本記録成立＋画像欠落通知）

### ユーザーストーリー3 の実装

- [ ] T034 [P] [US3] オブジェクトストレージ・ラッパを実装 `src/storage/imageStore.ts`（R2 既定、署名付きPUT URL 発行・参照URL生成。T012 の知見を反映）
- [ ] T035 [US3] `get_upload_url` ツールを実装 `src/tools/getUploadUrl.ts`（短命・単一用途）
- [ ] T036 [US3] `record_wine` の `imageUrl` を自ストレージ https のみ許可するよう検証強化 `src/tools/recordWine.ts`
- [ ] T037 [US3] 確認ウィジェットにファイル選択→直接アップロードを追加 `src/widgets/confirmRecord/`
- [ ] T038 [US3] 画像保存失敗時のフォールバック（基本記録は成立、欠落通知）を実装 `src/tools/recordWine.ts`
- [ ] T039 [US3] `get_upload_url` をサーバーに登録 `src/server.ts`

**チェックポイント**: 全ユーザーストーリーが独立に動作。

---

## フェーズ7: 仕上げと横断的関心事

- [ ] T040 [P] README と `.env.example` を最新化 `README.md`
- [ ] T041 [P] セキュリティ・ハードニング（Helmet 設定確認・署名URL短命・エラーに秘匿情報を出さない）
- [ ] T042 quickstart.md の検証シナリオを手動実行（Claude モバイルで端から端）
- [ ] T043 Codex モバイルでの画像受け渡し・アップロード挙動を検証し差分を記録（R5 リスク、T012/T013 の本番再確認）
- [ ] T044 [P] エッジケースの追加ユニットテスト `tests/unit/`（部分抽出 / NV / 画像欠落）

---

## 依存関係と実行順序

### フェーズ依存

- **セットアップ（フェーズ1）**: 依存なし。
- **基盤（フェーズ2）**: セットアップ完了後。全ストーリーをブロック。特に T010（JSA データ）は US2 の前提。
- **デリスク・スパイク（フェーズ3）**: 基盤後・US1 前に実施。重大制約が出たら設計（plan/research）を更新してから先へ。
- **ユーザーストーリー（フェーズ4以降）**: スパイク通過後。優先度順 P1→P2→P3、または独立に並行可能。
- **仕上げ（フェーズ7）**: 対象ストーリー完了後。

### ユーザーストーリー依存

- **US1 (P1)**: スパイク通過後に開始可。他ストーリーに依存しない（MVP）。
- **US2 (P2)**: スパイク通過 + T010 後。US1 の記録に表現を追加する形だが、独立にテスト可能。
- **US3 (P3)**: スパイク通過後。US1 の記録に画像を紐づけるが、独立にテスト可能。

### 各ユーザーストーリー内

- テストを先に書き、失敗を確認してから実装（憲章 II）。
- 型/ドメイン → ストレージ → ツール → ウィジェット → サーバー登録 の順。

### 並列化の機会

- セットアップの [P] タスク（T002–T005）は並行可。
- 基盤の [P] タスク（T006–T009, T011）は並行可。
- スパイク（T012–T014）は互いに独立で並行可。
- 各ストーリーの [P] テスト（T015–T017 等）は並行可。
- スパイク通過後、US1/US2/US3 は別担当で並行可能。

---

## 実装戦略

### まずデリスク、次に MVP

1. フェーズ1 セットアップ → フェーズ2 基盤。
2. **フェーズ3 スパイク**: 画像パス・vision・無料枠インデックスを最小コードで検証。
   制約が出たら設計を更新（`/speckit-implement` の前にやる価値が最も高い）。
3. フェーズ4 US1（基本記録, MVP）→ **停止して検証**（保存・取得・承認ゲート）。

### 段階的デリバリー

1. セットアップ + 基盤 + スパイク → 土台と前提検証。
2. US1（基本記録, MVP）→ 検証 → デモ。
3. US2（JSA タップ選択）→ 検証 → デモ。
4. US3（ラベル画像の永続化）→ 検証 → デモ。

---

## 補足

- [P] = 別ファイル・依存なし。 [SPIKE] = 破棄可の検証コード。
- [Story] ラベルでトレーサビリティを確保。
- テストは実装前に失敗を確認。
- 各タスク / 論理単位ごとにコミット（憲章 開発ワークフロー）。
- 検索・観点別提示は本スコープ外（次スコープ）。ただし保存時に namespace 構造と
  産地階層・年メタデータを正しく書くことで、その前提を満たす（原則 IV）。
