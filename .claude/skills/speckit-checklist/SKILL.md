---
name: "speckit-checklist"
description: "ユーザー要件に基づいて、現在の機能向けのカスタムチェックリストを生成する。"
argument-hint: "チェックリストのドメインまたは対象領域"
compatibility: ".specify/ ディレクトリを含む spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/checklist.md"
user-invocable: true
disable-model-invocation: false
---


## チェックリストの目的: 「英語のためのユニットテスト」

**重要な概念**: チェックリストは**要件記述のためのユニットテスト**である — それらは、特定のドメインにおける要件の品質、明確さ、完全性を検証する。

**検証／テストのためではない**:

- ❌ 「ボタンが正しくクリックできることを検証する」ではない
- ❌ 「エラー処理が機能することをテストする」ではない
- ❌ 「API が 200 を返すことを確認する」ではない
- ❌ コード／実装が仕様に一致するかをチェックすることではない

**要件品質の検証のため**:

- ✅ 「すべてのカード種別について視覚的階層の要件が定義されているか？」（完全性）
- ✅ 「'prominent display'（目立つ表示）が具体的なサイズ／配置で定量化されているか？」（明確さ）
- ✅ 「ホバー状態の要件がすべてのインタラクティブ要素で一貫しているか？」（一貫性）
- ✅ 「キーボードナビゲーションについてアクセシビリティ要件が定義されているか？」（カバレッジ）
- ✅ 「ロゴ画像の読み込みに失敗したときに何が起こるかを仕様が定義しているか？」（エッジケース）

**比喩**: 仕様が英語で書かれたコードだとすれば、チェックリストはそのユニットテストスイートである。あなたがテストしているのは、要件がよく書かれ、完全で、曖昧さがなく、実装の準備ができているかどうかであって — 実装が機能するかどうかではない。

## ユーザー入力

```text
$ARGUMENTS
```

先に進む前に、ユーザー入力を（空でなければ）**必ず**考慮すること。

## 実行前チェック

**拡張フックの確認（チェックリスト生成の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合、それを読み込み `hooks.before_checklist` キー配下のエントリを探す
- YAML がパースできない、または無効な場合は、フックチェックを黙って省略し通常どおり続行する
- `enabled` が明示的に `false` のフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようとは**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックを省略し、条件評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構成する際は、ドット（`.`）をハイフン（`-`）に置き換える。例: `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づき以下を出力する:
  - **任意フック**（`optional: true`）:
    ```
    ## 拡張フック

    **任意の事前フック**: {extension}
    コマンド: `/{command}`
    説明: {description}

    プロンプト: {prompt}
    実行するには: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## 拡張フック

    **自動の事前フック**: {extension}
    実行中: `/{command}`
    EXECUTE_COMMAND: {command}

    実行手順に進む前にフックコマンドの結果を待つこと。
    ```
- フックが1つも登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙って省略する

## 実行手順

1. **セットアップ**: リポジトリルートから `.specify/scripts/bash/check-prerequisites.sh --json` を実行し、FEATURE_DIR と AVAILABLE_DOCS のリストについて JSON をパースする。
   - すべてのファイルパスは絶対パスでなければならない。
   - "I'm Groot" のように引数にシングルクォートを含む場合は、エスケープ構文を使う: 例 'I'\''m Groot'（または可能なら二重引用符で囲む: "I'm Groot"）。

2. **存在する場合**: プロジェクトの原則とガバナンス制約のために `.specify/memory/constitution.md` を読み込む。

3. **意図の明確化（動的）**: 最大3つの初期文脈的な明確化質問を導出する（事前定義のカタログはない）。それらは以下を**必ず**満たすこと:
   - ユーザーの言い回し＋仕様/計画/タスクから抽出したシグナルから生成される
   - チェックリストの内容を実質的に変える情報についてのみ尋ねる
   - `$ARGUMENTS` ですでに曖昧さがない場合は、個別にスキップする
   - 幅広さより精度を優先する

   生成アルゴリズム:
   1. シグナルを抽出する: 機能ドメインのキーワード（例: auth、latency、UX、API）、リスク指標（"critical"、"must"、"compliance"）、ステークホルダーのヒント（"QA"、"review"、"security team"）、明示的な成果物（"a11y"、"rollback"、"contracts"）。
   2. シグナルを候補となる対象領域（最大4つ）にクラスタリングし、関連度でランク付けする。
   3. 明示されていない場合、想定される対象者＆タイミング（作成者、レビュアー、QA、リリース）を特定する。
   4. 欠落している次元を検出する: スコープの幅、深さ／厳密さ、リスクの強調、除外境界、測定可能な受け入れ基準。
   5. 以下のアーキタイプから選んだ質問を作成する:
      - スコープの精緻化（例: 「これは X と Y との統合接点を含むべきか、それともローカルモジュールの正しさに限定すべきか？」）
      - リスクの優先順位付け（例: 「これらの潜在的リスク領域のうち、どれに必須のゲートチェックを設けるべきか？」）
      - 深さの調整（例: 「これは軽量なコミット前の確認リストか、それとも正式なリリースゲートか？」）
      - 対象者のフレーミング（例: 「これは作成者のみが使うのか、それとも PR レビュー中に同僚も使うのか？」）
      - 境界の除外（例: 「今回はパフォーマンスチューニングの項目を明示的に除外すべきか？」）
      - シナリオクラスのギャップ（例: 「リカバリフローが検出されなかった — ロールバック／部分的障害のパスはスコープ内か？」）

   質問の書式ルール:
   - 選択肢を提示する場合は、列が Option | Candidate | Why It Matters のコンパクトな表を生成する
   - 選択肢は最大 A～E まで。自由記述の回答の方が明確なら表は省く
   - すでに述べたことをユーザーに再度述べさせない
   - 推測的なカテゴリを避ける（捏造しない）。不確かな場合は明示的に尋ねる: 「X がスコープに含まれるか確認してください。」

   対話が不可能な場合のデフォルト:
   - 深さ: Standard
   - 対象者: コード関連なら Reviewer（PR）。それ以外は Author
   - フォーカス: 関連度の上位2クラスタ

   質問を出力する（Q1/Q2/Q3 とラベル付け）。回答後: 2つ以上のシナリオクラス（Alternate / Exception / Recovery / Non-Functional ドメイン）が依然不明確なら、それぞれ一行の正当化（例: "Unresolved recovery path risk"）を添えて、的を絞った追加質問を最大2つ（Q4/Q5）尋ねて**よい**。質問は合計5つを超えないこと。ユーザーが明示的にこれ以上を断った場合はエスカレーションをスキップする。

4. **ユーザーの要求を理解する**: `$ARGUMENTS` ＋明確化の回答を組み合わせる:
   - チェックリストのテーマを導出する（例: security、review、deploy、ux）
   - ユーザーが言及した明示的な必須項目を統合する
   - フォーカスの選択をカテゴリの足場に対応付ける
   - 仕様/計画/タスクから欠けている文脈を推論する（捏造しないこと）

5. **機能コンテキストの読み込み**: FEATURE_DIR から読み込む:
   - spec.md: 機能要件とスコープ
   - plan.md（存在する場合）: 技術詳細、依存関係
   - tasks.md（存在する場合）: 実装タスク

   **コンテキスト読み込み戦略**:
   - アクティブな対象領域に関連する必要な部分のみを読み込む（ファイル全体のダンプを避ける）
   - 長いセクションは簡潔なシナリオ／要件の箇条書きに要約することを優先する
   - 漸進的開示を使う: ギャップが検出された場合のみ追加の取得を行う
   - ソースドキュメントが大きい場合は、生のテキストを埋め込むのではなく中間サマリ項目を生成する

6. **チェックリストの生成** - 「要件のためのユニットテスト」を作成する:
   - 存在しなければ `FEATURE_DIR/checklists/` ディレクトリを作成する
   - 一意なチェックリストのファイル名を生成する:
     - ドメインに基づいた短く説明的な名前を使う（例: `ux.md`、`api.md`、`security.md`）
     - 形式: `[domain].md`
   - ファイルの取り扱い動作:
     - ファイルが存在しない場合: 新しいファイルを作成し、項目を CHK001 から番号付けする
     - ファイルが存在する場合: 既存ファイルに新しい項目を追記し、最後の CHK ID から続ける（例: 最後の項目が CHK015 なら、新しい項目は CHK016 から始める）
   - 既存のチェックリストの内容を決して削除または置換しない — 常に保持して追記する

   **中核原則 - 実装ではなく要件をテストする**:
   すべてのチェックリスト項目は、**要件そのもの**を以下について評価しなければならない:
   - **完全性**: 必要な要件がすべて存在するか？
   - **明確さ**: 要件が曖昧さなく具体的か？
   - **一貫性**: 要件が互いに整合しているか？
   - **測定可能性**: 要件を客観的に検証できるか？
   - **カバレッジ**: すべてのシナリオ／エッジケースが扱われているか？

   **カテゴリ構造** - 項目を要件品質の次元でグループ化する:
   - **要件の完全性**（必要な要件がすべて文書化されているか？）
   - **要件の明確さ**（要件が具体的で曖昧さがないか？）
   - **要件の一貫性**（要件が衝突なく整合しているか？）
   - **受け入れ基準の品質**（成功基準が測定可能か？）
   - **シナリオのカバレッジ**（すべてのフロー／ケースが扱われているか？）
   - **エッジケースのカバレッジ**（境界条件が定義されているか？）
   - **非機能要件**（パフォーマンス、セキュリティ、アクセシビリティなど — 指定されているか？）
   - **依存関係と前提**（文書化され検証されているか？）
   - **曖昧さと衝突**（何の明確化が必要か？）

   **チェックリスト項目の書き方 - 「英語のためのユニットテスト」**:

   ❌ **誤り**（実装をテストしている）:
   - "Verify landing page displays 3 episode cards"
   - "Test hover states work on desktop"
   - "Confirm logo click navigates home"

   ✅ **正しい**（要件品質をテストしている）:
   - "Are the exact number and layout of featured episodes specified?" [Completeness]
   - "Is 'prominent display' quantified with specific sizing/positioning?" [Clarity]
   - "Are hover state requirements consistent across all interactive elements?" [Consistency]
   - "Are keyboard navigation requirements defined for all interactive UI?" [Coverage]
   - "Is the fallback behavior specified when logo image fails to load?" [Edge Cases]
   - "Are loading states defined for asynchronous episode data?" [Completeness]
   - "Does the spec define visual hierarchy for competing UI elements?" [Clarity]

   **項目の構造**:
   各項目は次のパターンに従うべき:
   - 要件品質について問う質問形式
   - 仕様／計画に書かれている（または書かれていない）ことに焦点を当てる
   - 品質の次元を角括弧で含める [Completeness/Clarity/Consistency/etc.]
   - 既存の要件をチェックするときは仕様セクション `[Spec §X.Y]` を参照する
   - 欠落している要件をチェックするときは `[Gap]` マーカーを使う

   **品質次元ごとの例**:

   完全性:
   - "Are error handling requirements defined for all API failure modes? [Gap]"
   - "Are accessibility requirements specified for all interactive elements? [Completeness]"
   - "Are mobile breakpoint requirements defined for responsive layouts? [Gap]"

   明確さ:
   - "Is 'fast loading' quantified with specific timing thresholds? [Clarity, Spec §NFR-2]"
   - "Are 'related episodes' selection criteria explicitly defined? [Clarity, Spec §FR-5]"
   - "Is 'prominent' defined with measurable visual properties? [Ambiguity, Spec §FR-4]"

   一貫性:
   - "Do navigation requirements align across all pages? [Consistency, Spec §FR-10]"
   - "Are card component requirements consistent between landing and detail pages? [Consistency]"

   カバレッジ:
   - "Are requirements defined for zero-state scenarios (no episodes)? [Coverage, Edge Case]"
   - "Are concurrent user interaction scenarios addressed? [Coverage, Gap]"
   - "Are requirements specified for partial data loading failures? [Coverage, Exception Flow]"

   測定可能性:
   - "Are visual hierarchy requirements measurable/testable? [Acceptance Criteria, Spec §FR-1]"
   - "Can 'balanced visual weight' be objectively verified? [Measurability, Spec §FR-2]"

   **シナリオ分類＆カバレッジ**（要件品質の観点）:
   - 次のシナリオの要件が存在するか確認する: Primary、Alternate、Exception/Error、Recovery、Non-Functional
   - 各シナリオクラスについて尋ねる: "Are [scenario type] requirements complete, clear, and consistent?"
   - シナリオクラスが欠けている場合: "Are [scenario type] requirements intentionally excluded or missing? [Gap]"
   - 状態変更が発生する場合はレジリエンス／ロールバックを含める: "Are rollback requirements defined for migration failures? [Gap]"

   **トレーサビリティ要件**:
   - 最低条件: 項目の 80% 以上が少なくとも1つのトレーサビリティ参照を**必ず**含むこと
   - 各項目は次を参照すべき: 仕様セクション `[Spec §X.Y]`、またはマーカーを使う: `[Gap]`、`[Ambiguity]`、`[Conflict]`、`[Assumption]`
   - ID システムが存在しない場合: "Is a requirement & acceptance criteria ID scheme established? [Traceability]"

   **課題の表面化＆解決**（要件品質の問題）:
   要件そのものについて質問する:
   - 曖昧さ: "Is the term 'fast' quantified with specific metrics? [Ambiguity, Spec §NFR-1]"
   - 衝突: "Do navigation requirements conflict between §FR-10 and §FR-10a? [Conflict]"
   - 前提: "Is the assumption of 'always available podcast API' validated? [Assumption]"
   - 依存関係: "Are external podcast API requirements documented? [Dependency, Gap]"
   - 定義の欠落: "Is 'visual hierarchy' defined with measurable criteria? [Gap]"

   **内容の統合**:
   - ソフト上限: 生の候補項目が40を超える場合は、リスク／影響度で優先順位を付ける
   - 同じ要件の側面をチェックするほぼ重複した項目をマージする
   - 影響度の低いエッジケースが5つを超える場合は、1つの項目を作る: "Are edge cases X, Y, Z addressed in requirements? [Coverage]"

   **🚫 絶対禁止** - これらは要件テストではなく実装テストにしてしまう:
   - ❌ "Verify"、"Test"、"Confirm"、"Check" ＋実装の挙動で始まる項目
   - ❌ コード実行、ユーザーの操作、システムの挙動への言及
   - ❌ "Displays correctly"、"works properly"、"functions as expected"
   - ❌ "Click"、"navigate"、"render"、"load"、"execute"
   - ❌ テストケース、テスト計画、QA 手順
   - ❌ 実装詳細（フレームワーク、API、アルゴリズム）

   **✅ 必須パターン** - これらは要件品質をテストする:
   - ✅ "Are [requirement type] defined/specified/documented for [scenario]?"
   - ✅ "Is [vague term] quantified/clarified with specific criteria?"
   - ✅ "Are requirements consistent between [section A] and [section B]?"
   - ✅ "Can [requirement] be objectively measured/verified?"
   - ✅ "Are [edge cases/scenarios] addressed in requirements?"
   - ✅ "Does the spec define [missing aspect]?"

7. **構造の参照**: タイトル、メタセクション、カテゴリ見出し、ID 書式については、`.specify/templates/checklist-template.md` の正規テンプレートに従ってチェックリストを生成する。テンプレートが利用できない場合は次を使う: H1 タイトル、purpose/created のメタ行、`- [ ] CHK### <requirement item>` 行を含む `##` カテゴリセクション。ID は CHK001 から始まりグローバルにインクリメントする。

8. **報告**: チェックリストファイルへのフルパス、項目数を出力し、実行が新しいファイルを作成したか既存ファイルに追記したかを要約する。次を要約する:
   - 選択された対象領域
   - 深さレベル
   - アクター／タイミング
   - 取り込んだ、ユーザーが明示的に指定した必須項目

**重要**: `/speckit-checklist` コマンドの各呼び出しは、短く説明的なチェックリストのファイル名を使い、新しいファイルを作成するか既存ファイルに追記する。これにより以下が可能になる:

- 異なる種別の複数のチェックリスト（例: `ux.md`、`test.md`、`security.md`）
- チェックリストの目的を示す、シンプルで覚えやすいファイル名
- `checklists/` フォルダ内での容易な識別とナビゲーション

散らかりを避けるため、説明的な種別を使い、完了したら不要になったチェックリストを整理する。

## チェックリスト種別の例＆サンプル項目

**UX 要件品質:** `ux.md`

サンプル項目（実装ではなく要件をテストする）:

- "Are visual hierarchy requirements defined with measurable criteria? [Clarity, Spec §FR-1]"
- "Is the number and positioning of UI elements explicitly specified? [Completeness, Spec §FR-1]"
- "Are interaction state requirements (hover, focus, active) consistently defined? [Consistency]"
- "Are accessibility requirements specified for all interactive elements? [Coverage, Gap]"
- "Is fallback behavior defined when images fail to load? [Edge Case, Gap]"
- "Can 'prominent display' be objectively measured? [Measurability, Spec §FR-4]"

**API 要件品質:** `api.md`

サンプル項目:

- "Are error response formats specified for all failure scenarios? [Completeness]"
- "Are rate limiting requirements quantified with specific thresholds? [Clarity]"
- "Are authentication requirements consistent across all endpoints? [Consistency]"
- "Are retry/timeout requirements defined for external dependencies? [Coverage, Gap]"
- "Is versioning strategy documented in requirements? [Gap]"

**パフォーマンス要件品質:** `performance.md`

サンプル項目:

- "Are performance requirements quantified with specific metrics? [Clarity]"
- "Are performance targets defined for all critical user journeys? [Coverage]"
- "Are performance requirements under different load conditions specified? [Completeness]"
- "Can performance requirements be objectively measured? [Measurability]"
- "Are degradation requirements defined for high-load scenarios? [Edge Case, Gap]"

**セキュリティ要件品質:** `security.md`

サンプル項目:

- "Are authentication requirements specified for all protected resources? [Coverage]"
- "Are data protection requirements defined for sensitive information? [Completeness]"
- "Is the threat model documented and requirements aligned to it? [Traceability]"
- "Are security requirements consistent with compliance obligations? [Consistency]"
- "Are security failure/breach response requirements defined? [Gap, Exception Flow]"

## アンチ例: やってはいけないこと

**❌ 誤り - これらは要件ではなく実装をテストしている:**

```markdown
- [ ] CHK001 - Verify landing page displays 3 episode cards [Spec §FR-001]
- [ ] CHK002 - Test hover states work correctly on desktop [Spec §FR-003]
- [ ] CHK003 - Confirm logo click navigates to home page [Spec §FR-010]
- [ ] CHK004 - Check that related episodes section shows 3-5 items [Spec §FR-005]
```

**✅ 正しい - これらは要件品質をテストしている:**

```markdown
- [ ] CHK001 - Are the number and layout of featured episodes explicitly specified? [Completeness, Spec §FR-001]
- [ ] CHK002 - Are hover state requirements consistently defined for all interactive elements? [Consistency, Spec §FR-003]
- [ ] CHK003 - Are navigation requirements clear for all clickable brand elements? [Clarity, Spec §FR-010]
- [ ] CHK004 - Is the selection criteria for related episodes documented? [Gap, Spec §FR-005]
- [ ] CHK005 - Are loading state requirements defined for asynchronous episode data? [Gap]
- [ ] CHK006 - Can "visual hierarchy" requirements be objectively measured? [Measurability, Spec §FR-001]
```

**主な違い:**

- 誤り: システムが正しく機能するかをテストする
- 正しい: 要件が正しく書かれているかをテストする
- 誤り: 挙動の検証
- 正しい: 要件品質の検証
- 誤り: 「それは X をするか？」
- 正しい: 「X は明確に仕様化されているか？」

## 実行後チェック

**拡張フックの確認（チェックリスト生成の後）**:
プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合、それを読み込み `hooks.after_checklist` キー配下のエントリを探す
- YAML がパースできない、または無効な場合は、フックチェックを黙って省略し通常どおり続行する
- `enabled` が明示的に `false` のフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようとは**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックを省略し、条件評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構成する際は、ドット（`.`）をハイフン（`-`）に置き換える。例: `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づき以下を出力する:
  - **任意フック**（`optional: true`）:
    ```
    ## 拡張フック

    **任意フック**: {extension}
    コマンド: `/{command}`
    説明: {description}

    プロンプト: {prompt}
    実行するには: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## 拡張フック

    **自動フック**: {extension}
    実行中: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
- フックが1つも登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙って省略する
