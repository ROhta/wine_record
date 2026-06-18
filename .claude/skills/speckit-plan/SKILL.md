---
name: "speckit-plan"
description: "計画テンプレートを使って実装計画ワークフローを実行し、設計成果物を生成する。"
argument-hint: "計画フェーズへの任意のガイダンス"
compatibility: ".specify/ ディレクトリを持つ spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/plan.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力を（空でない場合）**必ず**考慮しなければならない。

## 実行前チェック

**拡張フックの確認（計画の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.before_plan` キー配下のエントリを探す
- YAML を解析できない、または不正な場合は、フックのチェックを黙ってスキップし、通常どおり続行する
- `enabled` が明示的に `false` になっているフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようと**してはならない**:
  - フックに `condition` フィールドがない、または null／空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構築する際は、ドット（`.`）をハイフン（`-`）に置き換える。例えば `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づいて以下を出力する:
  - **オプションフック**（`optional: true`）:
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

    概要に進む前にフックコマンドの結果を待つこと。
    ```
- フックが何も登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする

## 概要

1. **セットアップ**: リポジトリルートから `.specify/scripts/bash/setup-plan.sh --json` を実行し、FEATURE_SPEC、IMPL_PLAN、SPECS_DIR、BRANCH について JSON を解析する。"I'm Groot" のように引数内に単一引用符がある場合は、エスケープ構文を使う: 例 'I'\''m Groot'（可能なら二重引用符で囲む: "I'm Groot"）。

2. **コンテキストの読み込み**: FEATURE_SPEC と `.specify/memory/constitution.md` を読む。IMPL_PLAN テンプレート（すでにコピー済み）を読み込む。

3. **計画ワークフローの実行**: IMPL_PLAN テンプレートの構造に従って、次を行う:
   - Technical Context を埋める（不明な点は "NEEDS CLARIFICATION" とマークする）
   - 憲章から Constitution Check セクションを埋める
   - ゲートを評価する（違反が正当化されない場合は ERROR）
   - Phase 0: research.md を生成する（すべての NEEDS CLARIFICATION を解決する）
   - Phase 1: data-model.md、contracts/、quickstart.md を生成する
   - Phase 1: エージェントスクリプトを実行してエージェントコンテキストを更新する
   - 設計後に Constitution Check を再評価する

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了しなければならない。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない、または `hooks.after_plan` 配下にフックが登録されていない場合は、Completion Report に進む。
- 存在する場合はそれを読み込み、`hooks.after_plan` キー配下のエントリを探す。
- YAML を解析できない、または不正な場合は、フックのチェックを黙ってスキップし、Completion Report に進む。
- `enabled` が明示的に `false` になっているフックを除外する。`enabled` フィールドを持たないフックはデフォルトで有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈または評価しようと**してはならない**:
  - フックに `condition` フィールドがない、または null／空の場合、そのフックを実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- フックのコマンド名からスラッシュコマンドを構築する際は、ドット（`.`）をハイフン（`-`）に置き換える。例えば `speckit.git.commit` → `/speckit-git-commit`。
- 実行可能な各フックについて、その `optional` フラグに基づいて以下を出力する:
  - **必須フック**（`optional: false`） — **各必須フックについて `EXECUTE_COMMAND:` を必ず出力しなければならない**:
    ```
    ## 拡張フック

    **自動フック**: {extension}
    実行中: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
  - **オプションフック**（`optional: true`）:
    ```
    ## 拡張フック

    **任意フック**: {extension}
    コマンド: `/{command}`
    説明: {description}

    プロンプト: {prompt}
    実行するには: `/{command}`
    ```

## 完了レポート

コマンドは Phase 2 の計画の後に終了する。ブランチ、IMPL_PLAN のパス、生成された成果物を報告する。

## フェーズ

### Phase 0: 概要と調査

1. 上記の **Technical Context から不明な点を抽出する**:
   - 各 NEEDS CLARIFICATION → 調査タスク
   - 各依存関係 → ベストプラクティスのタスク
   - 各統合 → パターンのタスク

2. **調査エージェントを生成してディスパッチする**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. 次の形式で `research.md` に**調査結果を統合する**:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**出力**: すべての NEEDS CLARIFICATION が解決された research.md

### Phase 1: 設計とコントラクト

**前提条件:** `research.md` が完成していること

1. **機能仕様からエンティティを抽出する** → `data-model.md`:
   - エンティティ名、フィールド、関係
   - 要件からの検証ルール
   - 該当する場合は状態遷移

2. **インターフェースのコントラクトを定義する**（プロジェクトに外部インターフェースがある場合）→ `/contracts/`:
   - プロジェクトがユーザーや他システムに公開しているインターフェースを特定する
   - プロジェクトの種類に適したコントラクト形式を記述する
   - 例: ライブラリの公開 API、CLI ツールのコマンドスキーマ、Web サービスのエンドポイント、パーサーの文法、アプリケーションの UI コントラクト
   - プロジェクトが純粋に内部用（ビルドスクリプト、使い捨てツールなど）の場合はスキップする

3. **クイックスタート検証ガイドを作成する** → `quickstart.md`:
   - 機能がエンドツーエンドで動作することを証明する、実行可能な検証シナリオを記述する
   - 前提条件、セットアップコマンド、テスト／実行コマンド、期待される結果を含める
   - コントラクトやデータモデルの詳細は複製せず、リンクや参照を使う
   - 完全な実装コード、モデル／サービス／コントローラの本体、マイグレーション、完全なテストスイートは含めない
   - この成果物は検証／実行ガイドとして保つ。実装の詳細は `tasks.md` と実装フェーズに属する

4. **エージェントコンテキストの更新**:
   - `CLAUDE.md` の `<!-- SPECKIT START -->` と `<!-- SPECKIT END -->` マーカーの間にある計画への参照を、ステップ 1 で作成した計画ファイル（IMPL_PLAN のパス）を指すように更新する

**出力**: data-model.md、/contracts/*、quickstart.md、更新されたエージェントコンテキストファイル

## 主要なルール

- ファイルシステム操作には絶対パスを使う。ドキュメントやエージェントコンテキストファイル内の参照にはプロジェクト相対パスを使う
- ゲートの失敗または未解決の明確化がある場合は ERROR

## 完了条件

- [ ] 計画ワークフローが実行され、設計成果物が生成されている
- [ ] 上記の「必須の実行後フック」のルールに従って、拡張フックがディスパッチまたはスキップされている
- [ ] ブランチ、計画のパス、生成された成果物とともに、完了がユーザーに報告されている
