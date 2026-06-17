---
name: "speckit-specify"
description: "自然言語の機能説明から機能仕様を作成・更新する。"
argument-hint: "仕様化したい機能を説明する"
compatibility: ".specify/ ディレクトリを持つ spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/specify.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力を（空でない場合）**必ず**考慮しなければならない。

## 実行前チェック

**拡張フックの確認（仕様化の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.before_specify` キー配下のエントリを探す
- YAML を解析できない、または不正な場合は、フックのチェックを黙ってスキップし、通常どおり続行する
- `enabled` が明示的に `false` になっているフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようと**してはならない**:
  - フックに `condition` フィールドがない、または null／空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構築する際は、ドット（`.`）をハイフン（`-`）に置き換える。例えば `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づいて以下を出力する:
  - **オプションフック**（`optional: true`）:
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- フックが何も登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする

## 概要

トリガーとなったメッセージで `/speckit-specify` の後にユーザーが入力したテキスト**こそ**が機能説明である。下に `$ARGUMENTS` が文字どおり現れていても、それはこの会話で常に利用可能であると想定すること。ユーザーが空のコマンドを与えた場合を除き、繰り返すよう求めてはならない。

その機能説明をもとに、以下を行う:

1. 機能の**簡潔なショートネーム**（2〜4 語）を**生成する**:
   - 機能説明を分析し、最も意味のあるキーワードを抽出する
   - 機能の本質を捉えた 2〜4 語のショートネームを作る
   - 可能な場合は動詞-名詞形式を使う（例: "add-user-auth"、"fix-payment-bug"）
   - 専門用語や略語は保持する（OAuth2、API、JWT など）
   - 簡潔でありながら、ひと目で機能が分かる程度に説明的に保つ
   - 例:
     - "I want to add user authentication" → "user-auth"
     - "Implement OAuth2 integration for the API" → "oauth2-api-integration"
     - "Create a dashboard for analytics" → "analytics-dashboard"
     - "Fix payment processing timeout bug" → "fix-payment-timeout"

2. **ブランチの作成**（オプション、フック経由）:

   上記の実行前チェックで `before_specify` フックが正常に実行された場合、それは git ブランチを作成／切り替え、`BRANCH_NAME` と `FEATURE_NUM` を含む JSON を出力しているはずである。これらの値は参考として控えておくが、ブランチ名が仕様ディレクトリ名を**決めるわけではない**。

   ユーザーが明示的に `GIT_BRANCH_NAME` を提供した場合、ブランチスクリプトがその正確な値をブランチ名として使う（すべての接頭辞／接尾辞生成をバイパスする）よう、それをフックに渡す。

3. **仕様の機能ディレクトリを作成する**:

   ユーザーが明示的に `SPECIFY_FEATURE_DIRECTORY` を提供しない限り、仕様はデフォルトの `specs/` ディレクトリ配下に置かれる。

   **`SPECIFY_FEATURE_DIRECTORY` の解決順序**:
   1. ユーザーが明示的に `SPECIFY_FEATURE_DIRECTORY` を提供した場合（例: 環境変数、引数、設定経由）、それをそのまま使う
   2. そうでない場合は、`specs/` 配下に自動生成する:
      - `.specify/init-options.json` の `feature_numbering`（推奨）または `branch_numbering`（非推奨、移行用のみ — 将来のリリースで削除される）を確認する
      - `"timestamp"` の場合: 接頭辞は `YYYYMMDD-HHMMSS`（現在のタイムスタンプ）
      - `"sequential"` の場合または無い場合: 接頭辞は `NNN`（`specs/` 内の既存ディレクトリをスキャンした後の、次に利用可能な 3 桁の番号）
      - ディレクトリ名を構築する: `<prefix>-<short-name>`（例: `003-user-auth` または `20260319-143022-user-auth`）
      - `SPECIFY_FEATURE_DIRECTORY` を `specs/<directory-name>` に設定する
      - `branch_numbering` が使われた場合（かつ `feature_numbering` が無かった場合）、1 行の警告を出す: "⚠️ `branch_numbering` in init-options.json is deprecated. Rename to `feature_numbering`."

   **ディレクトリと仕様ファイルを作成する**:
   - `mkdir -p SPECIFY_FEATURE_DIRECTORY`
   - Spec Kit のプリセット／テンプレート解決スタックを通じて、有効な `spec-template` を解決する（`specify preset resolve spec-template` に相当）
   - 解決した `spec-template` ファイルを出発点として `SPECIFY_FEATURE_DIRECTORY/spec.md` にコピーする
   - `SPEC_FILE` を `SPECIFY_FEATURE_DIRECTORY/spec.md` に設定する
   - 解決したパスを `.specify/feature.json` に永続化する:
     ```json
     {
       "feature_directory": "<resolved feature dir>"
     }
     ```
     リテラル文字列 `SPECIFY_FEATURE_DIRECTORY` ではなく、実際に解決したディレクトリパスの値（例: `specs/003-user-auth`）を書き込む。
     これにより、下流のコマンド（`/speckit-plan`、`/speckit-tasks` など）が git ブランチ名の慣習に頼ることなく機能ディレクトリを見つけられる。

   **重要**:
   - `/speckit-specify` の呼び出し 1 回につき、機能は 1 つだけ作成しなければならない
   - 仕様ディレクトリ名と git ブランチ名は独立している — 同じにすることもできるが、それはユーザーの選択である
   - 仕様ディレクトリとファイルは常にこのコマンドによって作成され、フックによって作成されることはない

4. 必須セクションを把握するため、解決した有効な `spec-template` ファイルを読み込む。

5. **存在する場合**: プロジェクトの原則とガバナンス制約のために `.specify/memory/constitution.md` を読み込む。

6. この実行フローに従う:
    1. 引数からユーザーの説明を解析する
       空の場合: ERROR "No feature description provided"
    2. 説明から主要な概念を抽出する
       特定する: アクター、アクション、データ、制約
    3. 不明確な側面について:
       - コンテキストと業界標準に基づいて、根拠のある推測を行う
       - 次の場合にのみ [NEEDS CLARIFICATION: specific question] でマークする:
         - その選択が機能のスコープやユーザー体験に大きく影響する
         - 異なる含意を持つ複数の妥当な解釈が存在する
         - 妥当なデフォルトが存在しない
       - **制限: [NEEDS CLARIFICATION] マーカーは合計で最大 3 個**
       - 明確化は影響度で優先順位を付ける: スコープ > セキュリティ／プライバシー > ユーザー体験 > 技術的詳細
    4. User Scenarios & Testing セクションを埋める
       明確なユーザーフローがない場合: ERROR "Cannot determine user scenarios"
    5. Functional Requirements を生成する
       各要件はテスト可能でなければならない
       指定されていない詳細には妥当なデフォルトを使う（前提を Assumptions セクションに記録する）
    6. Success Criteria を定義する
       測定可能で技術非依存の成果を作る
       定量的な指標（時間、パフォーマンス、ボリューム）と定性的な尺度（ユーザー満足度、タスク完了）の両方を含める
       各基準は実装の詳細なしに検証可能でなければならない
    7. 主要なエンティティを特定する（データが関わる場合）
    8. 返す: SUCCESS（仕様は計画の準備完了）

6. テンプレートの構造を使って仕様を SPEC_FILE に書き込む。セクションの順序と見出しを維持しつつ、プレースホルダを機能説明（引数）から導出した具体的な詳細に置き換える。

7. **仕様品質の検証**: 初期仕様を書いた後、品質基準に照らして検証する:

   a. **仕様品質チェックリストを作成する**: チェックリストテンプレートの構造を使い、次の検証項目を含むチェックリストファイルを `SPECIFY_FEATURE_DIRECTORY/checklists/requirements.md` に生成する:

      ```markdown
      # Specification Quality Checklist: [FEATURE NAME]
      
      **Purpose**: Validate specification completeness and quality before proceeding to planning
      **Created**: [DATE]
      **Feature**: [Link to spec.md]
      
      ## Content Quality
      
      - [ ] No implementation details (languages, frameworks, APIs)
      - [ ] Focused on user value and business needs
      - [ ] Written for non-technical stakeholders
      - [ ] All mandatory sections completed
      
      ## Requirement Completeness
      
      - [ ] No [NEEDS CLARIFICATION] markers remain
      - [ ] Requirements are testable and unambiguous
      - [ ] Success criteria are measurable
      - [ ] Success criteria are technology-agnostic (no implementation details)
      - [ ] All acceptance scenarios are defined
      - [ ] Edge cases are identified
      - [ ] Scope is clearly bounded
      - [ ] Dependencies and assumptions identified
      
      ## Feature Readiness
      
      - [ ] All functional requirements have clear acceptance criteria
      - [ ] User scenarios cover primary flows
      - [ ] Feature meets measurable outcomes defined in Success Criteria
      - [ ] No implementation details leak into specification
      
      ## Notes
      
      - Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
      ```

   b. **検証チェックを実行する**: 各チェックリスト項目に照らして仕様をレビューする:
      - 各項目について、合格か不合格かを判定する
      - 見つかった具体的な問題を記録する（該当する仕様セクションを引用する）

   c. **検証結果を処理する**:

      - **すべての項目が合格した場合**: チェックリストを完了とマークし、必須の実行後フックのセクションに進む

      - **項目が不合格の場合（[NEEDS CLARIFICATION] を除く）**:
        1. 不合格の項目と具体的な問題を列挙する
        2. 各問題に対処するため仕様を更新する
        3. すべての項目が合格するまで検証を再実行する（最大 3 回）
        4. 3 回繰り返しても合格しない場合、残った問題をチェックリストのメモに記録し、ユーザーに警告する

      - **[NEEDS CLARIFICATION] マーカーが残っている場合**:
        1. 仕様からすべての [NEEDS CLARIFICATION: ...] マーカーを抽出する
        2. **制限チェック**: マーカーが 3 個を超える場合、最も重要な 3 個のみ（スコープ／セキュリティ／UX への影響で）を残し、残りは根拠のある推測を行う
        3. 必要な各明確化（最大 3 個）について、この形式でユーザーに選択肢を提示する:

           ```markdown
           ## Question [N]: [Topic]
           
           **Context**: [Quote relevant spec section]
           
           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]
           
           **Suggested Answers**:
           
           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | [First suggested answer] | [What this means for the feature] |
           | B      | [Second suggested answer] | [What this means for the feature] |
           | C      | [Third suggested answer] | [What this means for the feature] |
           | Custom | Provide your own answer | [Explain how to provide custom input] |
           
           **Your choice**: _[Wait for user response]_
           ```

        4. **重要 - テーブルの書式**: markdown テーブルが正しく整形されていることを確認する:
           - パイプを揃えて一貫した間隔を使う
           - 各セルは内容の前後にスペースを入れる: `|Content|` ではなく `| Content |`
           - ヘッダーの区切りは少なくとも 3 個のダッシュを持たなければならない: `|--------|`
           - テーブルが markdown プレビューで正しくレンダリングされることを確認する
        5. 質問に連番を付ける（Q1、Q2、Q3 - 合計最大 3 個）
        6. 回答を待つ前に、すべての質問をまとめて提示する
        7. すべての質問に対するユーザーの選択を待つ（例: "Q1: A, Q2: Custom - [details], Q3: B"）
        8. 各 [NEEDS CLARIFICATION] マーカーを、ユーザーが選択または提供した回答に置き換えて仕様を更新する
        9. すべての明確化が解決された後、検証を再実行する

   d. **チェックリストを更新する**: 各検証の反復の後、チェックリストファイルを現在の合格／不合格ステータスで更新する

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了しなければならない。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない、または `hooks.after_specify` 配下にフックが登録されていない場合は、Completion Report に進む。
- 存在する場合はそれを読み込み、`hooks.after_specify` キー配下のエントリを探す。
- YAML を解析できない、または不正な場合は、フックのチェックを黙ってスキップし、Completion Report に進む。
- `enabled` が明示的に `false` になっているフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようと**してはならない**:
  - フックに `condition` フィールドがない、または null／空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構築する際は、ドット（`.`）をハイフン（`-`）に置き換える。例えば `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づいて以下を出力する:
  - **必須フック**（`optional: false`） — **各必須フックについて `EXECUTE_COMMAND:` を必ず出力しなければならない**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
  - **オプションフック**（`optional: true`）:
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## 完了レポート

ユーザーに完了を報告し、次を含める:
- `SPECIFY_FEATURE_DIRECTORY` — 機能ディレクトリのパス
- `SPEC_FILE` — 仕様ファイルのパス
- チェックリスト結果のサマリー
- 次のフェーズ（`/speckit-clarify` または `/speckit-plan`）への準備状況

**注:** ブランチの作成は `before_specify` フック（git 拡張）が処理する。仕様ディレクトリとファイルの作成は常にこのコアコマンドが処理する。

## クイックガイドライン

- ユーザーが**何を（WHAT）**必要とし、**なぜ（WHY）**必要とするかに集中する。
- どう実装するか（HOW）は避ける（技術スタック、API、コード構造を書かない）。
- 開発者ではなく、ビジネスのステークホルダー向けに書く。
- 仕様に埋め込まれるチェックリストを作成してはならない。それは別のコマンドが扱う。

### セクションの要件

- **必須セクション**: すべての機能で完成させなければならない
- **オプションセクション**: 機能に関連する場合のみ含める
- セクションが該当しない場合は、まるごと削除する（「N/A」として残さない）

### AI 生成のために

ユーザープロンプトからこの仕様を作成する際:

1. **根拠のある推測を行う**: コンテキスト、業界標準、一般的なパターンを使ってギャップを埋める
2. **前提を記録する**: 妥当なデフォルトを Assumptions セクションに記録する
3. **明確化を制限する**: [NEEDS CLARIFICATION] マーカーは最大 3 個 - 次のような重要な決定にのみ使う:
   - 機能のスコープやユーザー体験に大きく影響する
   - 異なる含意を持つ複数の妥当な解釈がある
   - 妥当なデフォルトがまったくない
4. **明確化に優先順位を付ける**: スコープ > セキュリティ／プライバシー > ユーザー体験 > 技術的詳細
5. **テスターのように考える**: 曖昧な要件はすべて「テスト可能かつ明確」チェックリスト項目に不合格となるはずである
6. **明確化が必要になりやすい領域**（妥当なデフォルトが存在しない場合のみ）:
   - 機能のスコープと境界（特定のユースケースの包含／除外）
   - ユーザーの種類と権限（複数の矛盾する解釈があり得る場合）
   - セキュリティ／コンプライアンス要件（法的／財務的に重大な場合）

**妥当なデフォルトの例**（これらについては尋ねない）:

- データ保持: そのドメインにおける業界標準の慣行
- パフォーマンス目標: 指定がない限り標準的な Web／モバイルアプリの期待値
- エラー処理: 適切なフォールバックを伴うユーザーフレンドリーなメッセージ
- 認証方式: Web アプリ向けの標準的なセッションベースまたは OAuth2
- 統合パターン: プロジェクトに適したパターンを使う（Web サービスには REST/GraphQL、ライブラリには関数呼び出し、ツールには CLI 引数など）

### 成功基準のガイドライン

成功基準は次でなければならない:

1. **測定可能**: 具体的な指標（時間、パーセンテージ、件数、レート）を含める
2. **技術非依存**: フレームワーク、言語、データベース、ツールに言及しない
3. **ユーザー中心**: システム内部ではなく、ユーザー／ビジネスの観点から成果を記述する
4. **検証可能**: 実装の詳細を知らなくてもテスト／検証できる

**良い例**:

- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**悪い例**（実装中心）:

- "API response time is under 200ms"（技術的すぎる、"Users see results instantly" を使う）
- "Database can handle 1000 TPS"（実装の詳細、ユーザー向けの指標を使う）
- "React components render efficiently"（フレームワーク固有）
- "Redis cache hit rate above 80%"（技術固有）

## 完了条件

- [ ] 仕様が `SPEC_FILE` に書き込まれ、品質チェックリストに照らして検証されている
- [ ] 上記の「必須の実行後フック」のルールに従って、拡張フックがディスパッチまたはスキップされている
- [ ] 機能ディレクトリ、仕様ファイルのパス、チェックリスト結果とともに、完了がユーザーに報告されている
