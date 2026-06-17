---
name: "speckit-tasks"
description: "利用可能な設計成果物に基づいて、実行可能で依存関係順に並んだ機能の tasks.md を生成する。"
argument-hint: "タスク生成への任意の制約"
compatibility: ".specify/ ディレクトリを持つ spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/tasks.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力を（空でない場合）**必ず**考慮しなければならない。

## 実行前チェック

**拡張フックの確認（タスク生成の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.before_tasks` キー配下のエントリを探す
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

1. **セットアップ**: リポジトリルートから `.specify/scripts/bash/setup-tasks.sh --json` を実行し、FEATURE_DIR、TASKS_TEMPLATE、AVAILABLE_DOCS のリストを解析する。`FEATURE_DIR` と `TASKS_TEMPLATE` は、提供される場合は絶対パスでなければならない。`AVAILABLE_DOCS` は `FEATURE_DIR` 配下で利用可能なドキュメント名／相対パスのリストである（例えば `research.md` や `contracts/`）。"I'm Groot" のように引数内に単一引用符がある場合は、エスケープ構文を使う: 例 'I'\''m Groot'（可能なら二重引用符で囲む: "I'm Groot"）。

2. **設計ドキュメントの読み込み**: FEATURE_DIR から読む:
   - **必須**: plan.md（技術スタック、ライブラリ、構造）、spec.md（優先度付きのユーザーストーリー）
   - **オプション**: data-model.md（エンティティ）、contracts/（インターフェースのコントラクト）、research.md（決定事項）、quickstart.md（テストシナリオ）
   - **存在する場合**: プロジェクトの原則とガバナンス制約のために `.specify/memory/constitution.md` を読み込む
   - 注: すべてのプロジェクトがすべてのドキュメントを持つわけではない。利用可能なものに基づいてタスクを生成する。

3. **タスク生成ワークフローの実行**:
   - plan.md を読み込み、技術スタック、ライブラリ、プロジェクト構造を抽出する
   - spec.md を読み込み、優先度付き（P1、P2、P3 など）のユーザーストーリーを抽出する
   - data-model.md が存在する場合: エンティティを抽出してユーザーストーリーにマッピングする
   - contracts/ が存在する場合: インターフェースのコントラクトをユーザーストーリーにマッピングする
   - research.md が存在する場合: セットアップタスクのための決定事項を抽出する
   - ユーザーストーリーごとに整理したタスクを生成する（下記の Task Generation Rules を参照）
   - ユーザーストーリーの完了順を示す依存関係グラフを生成する
   - ユーザーストーリーごとに並列実行の例を作成する
   - タスクの完全性を検証する（各ユーザーストーリーが必要なすべてのタスクを持ち、独立してテスト可能であること）

4. **tasks.md の生成**: TASKS_TEMPLATE（上記の JSON 出力から）からタスクテンプレートを読み、それを構造として使う。TASKS_TEMPLATE が空の場合は `.specify/templates/tasks-template.md` にフォールバックする。次で埋める:
   - plan.md からの正しい機能名
   - Phase 1: セットアップタスク（プロジェクトの初期化）
   - Phase 2: 基盤タスク（すべてのユーザーストーリーのブロッキング前提条件）
   - Phase 3 以降: ユーザーストーリーごとに 1 フェーズ（spec.md の優先度順）
   - 各フェーズには次を含める: ストーリーのゴール、独立したテスト基準、テスト（要求された場合）、実装タスク
   - 最終フェーズ: 仕上げと横断的な関心事
   - すべてのタスクは厳格なチェックリスト形式に従わなければならない（下記の Task Generation Rules を参照）
   - 各タスクの明確なファイルパス
   - ストーリーの完了順を示す Dependencies セクション
   - ストーリーごとの並列実行の例
   - 実装戦略セクション（MVP を先に、段階的な提供）

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了しなければならない。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない、または `hooks.after_tasks` 配下にフックが登録されていない場合は、Completion Report に進む。
- 存在する場合はそれを読み込み、`hooks.after_tasks` キー配下のエントリを探す。
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

生成された tasks.md のパスとサマリーを出力する:
- 合計タスク数
- ユーザーストーリーごとのタスク数
- 特定された並列化の機会
- 各ストーリーの独立したテスト基準
- 推奨される MVP スコープ（通常は User Story 1 のみ）
- 形式の検証: すべてのタスクがチェックリスト形式（チェックボックス、ID、ラベル、ファイルパス）に従っていることを確認する

タスク生成のコンテキスト: $ARGUMENTS

tasks.md は即座に実行可能であるべきである - 各タスクは、LLM が追加のコンテキストなしに完了できる程度に具体的でなければならない。

## タスク生成ルール

**重要**: 独立した実装とテストを可能にするため、タスクはユーザーストーリーごとに整理しなければならない。

**テストはオプション**: テストタスクは、機能仕様で明示的に要求された場合、またはユーザーが TDD アプローチを要求した場合にのみ生成する。

### チェックリスト形式（必須）

すべてのタスクはこの形式に厳格に従わなければならない:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**形式の構成要素**:

1. **チェックボックス**: 常に `- [ ]`（markdown チェックボックス）で始める
2. **タスク ID**: 実行順の連番（T001、T002、T003…）
3. **[P] マーカー**: タスクが並列化可能な場合のみ含める（異なるファイル、未完了タスクへの依存がない）
4. **[Story] ラベル**: ユーザーストーリーフェーズのタスクにのみ必須
   - 形式: [US1]、[US2]、[US3] など（spec.md のユーザーストーリーにマッピングする）
   - セットアップフェーズ: ストーリーラベルなし
   - 基盤フェーズ: ストーリーラベルなし  
   - ユーザーストーリーフェーズ: ストーリーラベルが必須
   - 仕上げフェーズ: ストーリーラベルなし
5. **説明**: 正確なファイルパスを伴う明確なアクション

**例**:

- ✅ 正しい: `- [ ] T001 Create project structure per implementation plan`
- ✅ 正しい: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ 正しい: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ 正しい: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ 誤り: `- [ ] Create User model`（ID とストーリーラベルが欠落）
- ❌ 誤り: `T001 [US1] Create model`（チェックボックスが欠落）
- ❌ 誤り: `- [ ] [US1] Create User model`（タスク ID が欠落）
- ❌ 誤り: `- [ ] T001 [US1] Create model`（ファイルパスが欠落）

### タスクの整理

1. **ユーザーストーリーから（spec.md）** - 主たる整理:
   - 各ユーザーストーリー（P1、P2、P3…）が独自のフェーズを持つ
   - 関連するすべてのコンポーネントをそのストーリーにマッピングする:
     - そのストーリーに必要なモデル
     - そのストーリーに必要なサービス
     - そのストーリーに必要なインターフェース／UI
     - テストが要求された場合: そのストーリーに固有のテスト
   - ストーリーの依存関係をマークする（ほとんどのストーリーは独立しているべきである）

2. **コントラクトから**:
   - 各インターフェースのコントラクト → それが提供するユーザーストーリーにマッピングする
   - テストが要求された場合: 各インターフェースのコントラクト → そのストーリーのフェーズで実装の前にコントラクトテストタスク [P]

3. **データモデルから**:
   - 各エンティティを、それを必要とするユーザーストーリーにマッピングする
   - エンティティが複数のストーリーに使われる場合: 最も早いストーリーまたはセットアップフェーズに置く
   - 関係 → 適切なストーリーフェーズのサービス層タスク

4. **セットアップ／インフラから**:
   - 共有インフラ → セットアップフェーズ（Phase 1）
   - 基盤的／ブロッキングなタスク → 基盤フェーズ（Phase 2）
   - ストーリー固有のセットアップ → そのストーリーのフェーズ内

### フェーズ構造

- **Phase 1**: セットアップ（プロジェクトの初期化）
- **Phase 2**: 基盤（ブロッキングな前提条件 - ユーザーストーリーの前に完了しなければならない）
- **Phase 3 以降**: 優先度順のユーザーストーリー（P1、P2、P3…）
  - 各ストーリー内: テスト（要求された場合）→ モデル → サービス → エンドポイント → 統合
  - 各フェーズは完全で、独立してテスト可能な増分であるべきである
- **最終フェーズ**: 仕上げと横断的な関心事

## 完了条件

- [ ] すべてのフェーズ、タスク ID、ファイルパスを含む tasks.md が生成されている
- [ ] 上記の「必須の実行後フック」のルールに従って、拡張フックがディスパッチまたはスキップされている
- [ ] タスク数、ストーリーの内訳、MVP スコープとともに、完了がユーザーに報告されている
