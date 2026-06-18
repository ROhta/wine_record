---
name: "speckit-implement"
description: "tasks.md で定義されたすべてのタスクを処理・実行して実装計画を実行する"
argument-hint: "実装への任意のガイダンスまたはタスクフィルタ"
compatibility: ".specify/ ディレクトリを持つ spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/implement.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力を（空でない場合）**必ず**考慮しなければならない。

## 実行前チェック

**拡張フックの確認（実装の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.before_implement` キー配下のエントリを探す
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

1. リポジトリルートから `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` を実行し、FEATURE_DIR と AVAILABLE_DOCS のリストを解析する。すべてのパスは絶対パスでなければならない。"I'm Groot" のように引数内に単一引用符がある場合は、エスケープ構文を使う: 例 'I'\''m Groot'（可能なら二重引用符で囲む: "I'm Groot"）。

2. **チェックリストのステータスを確認する**（FEATURE_DIR/checklists/ が存在する場合）:
   - checklists/ ディレクトリ内のすべてのチェックリストファイルをスキャンする
   - 各チェックリストについて、次を数える:
     - 合計項目数: `- [ ]` または `- [X]` または `- [x]` に一致するすべての行
     - 完了項目数: `- [X]` または `- [x]` に一致する行
     - 未完了項目数: `- [ ]` に一致する行
   - ステータステーブルを作成する:

     ```text
     | チェックリスト | 合計 | 完了 | 未完了 | ステータス |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | ✓ PASS |
     | test.md   | 8     | 5         | 3          | ✗ FAIL |
     | security.md | 6   | 6         | 0          | ✓ PASS |
     ```

   - 全体のステータスを計算する:
     - **PASS**: すべてのチェックリストの未完了項目が 0
     - **FAIL**: 1 つ以上のチェックリストに未完了項目がある

   - **いずれかのチェックリストが未完了の場合**:
     - 未完了項目数とともにテーブルを表示する
     - **停止**して尋ねる: "一部のチェックリストが未完了です。それでも実装を続行しますか？ (yes/no)"
     - 続行する前にユーザーの応答を待つ
     - ユーザーが "no" または "wait" または "stop" と言った場合、実行を停止する
     - ユーザーが "yes" または "proceed" または "continue" と言った場合、ステップ 3 に進む

   - **すべてのチェックリストが完了している場合**:
     - すべてのチェックリストが合格していることを示すテーブルを表示する
     - 自動的にステップ 3 に進む

3. 実装のコンテキストを読み込んで分析する:
   - **必須**: 完全なタスクリストと実行計画のために tasks.md を読む
   - **必須**: 技術スタック、アーキテクチャ、ファイル構造のために plan.md を読む
   - **存在する場合**: エンティティと関係のために data-model.md を読む
   - **存在する場合**: API 仕様とテスト要件のために contracts/ を読む
   - **存在する場合**: 技術的決定と制約のために research.md を読む
   - **存在する場合**: ガバナンス制約のために .specify/memory/constitution.md を読む
   - **存在する場合**: 統合シナリオのために quickstart.md を読む

4. **プロジェクトセットアップの検証**:
   - **必須**: 実際のプロジェクトセットアップに基づいて ignore ファイルを作成／検証する:

   **検出と作成のロジック**:
   - 次のコマンドが成功するか確認して、リポジトリが git リポジトリかどうかを判定する（そうであれば .gitignore を作成／検証する）:

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Dockerfile* が存在する、または plan.md に Docker がある → .dockerignore を作成／検証する
   - .eslintrc* が存在する → .eslintignore を作成／検証する
   - eslint.config.* が存在する → 設定の `ignores` エントリが必要なパターンをカバーしていることを確認する
   - .prettierrc* が存在する → .prettierignore を作成／検証する
   - .npmrc または package.json が存在する → .npmignore を作成／検証する（公開する場合）
   - terraform ファイル（*.tf）が存在する → .terraformignore を作成／検証する
   - .helmignore が必要（helm チャートが存在する）→ .helmignore を作成／検証する

   **ignore ファイルがすでに存在する場合**: 必須パターンが含まれていることを確認し、欠けている重要なパターンのみを追記する
   **ignore ファイルが存在しない場合**: 検出された技術の完全なパターンセットで作成する

   **技術ごとの一般的なパターン**（plan.md の技術スタックから）:
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **C#/.NET**: `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
   - **Go**: `*.exe`, `*.test`, `vendor/`, `*.out`
   - **Ruby**: `.bundle/`, `log/`, `tmp/`, `*.gem`, `vendor/bundle/`
   - **PHP**: `vendor/`, `*.log`, `*.cache`, `*.env`
   - **Rust**: `target/`, `debug/`, `release/`, `*.rs.bk`, `*.rlib`, `*.prof*`, `.idea/`, `*.log`, `.env*`
   - **Kotlin**: `build/`, `out/`, `.gradle/`, `.idea/`, `*.class`, `*.jar`, `*.iml`, `*.log`, `.env*`
   - **C++**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.so`, `*.a`, `*.exe`, `*.dll`, `.idea/`, `*.log`, `.env*`
   - **C**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.a`, `*.so`, `*.exe`, `*.dll`, `autom4te.cache/`, `config.status`, `config.log`, `.idea/`, `*.log`, `.env*`
   - **Swift**: `.build/`, `DerivedData/`, `*.swiftpm/`, `Packages/`
   - **R**: `.Rproj.user/`, `.Rhistory`, `.RData`, `.Ruserdata`, `*.Rproj`, `packrat/`, `renv/`
   - **共通**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

   **ツール固有のパターン**:
   - **Docker**: `node_modules/`, `.git/`, `Dockerfile*`, `.dockerignore`, `*.log*`, `.env*`, `coverage/`
   - **ESLint**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.min.js`
   - **Prettier**: `node_modules/`, `dist/`, `build/`, `coverage/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - **Terraform**: `.terraform/`, `*.tfstate*`, `*.tfvars`, `.terraform.lock.hcl`
   - **Kubernetes/k8s**: `*.secret.yaml`, `secrets/`, `.kube/`, `kubeconfig*`, `*.key`, `*.crt`

5. tasks.md の構造を解析して抽出する:
   - **タスクフェーズ**: Setup、Tests、Core、Integration、Polish
   - **タスクの依存関係**: 逐次実行と並列実行のルール
   - **タスクの詳細**: ID、説明、ファイルパス、並列マーカー [P]
   - **実行フロー**: 順序と依存関係の要件

6. タスク計画に従って実装を実行する:
   - **フェーズごとの実行**: 次に進む前に各フェーズを完了する
   - **依存関係を尊重する**: 逐次タスクは順番に実行し、並列タスク [P] は一緒に実行できる  
   - **TDD アプローチに従う**: 対応する実装タスクの前にテストタスクを実行する
   - **ファイルベースの調整**: 同じファイルに影響するタスクは逐次的に実行しなければならない
   - **検証チェックポイント**: 進む前に各フェーズの完了を確認する

7. 実装の実行ルール:
   - **まずセットアップ**: プロジェクト構造、依存関係、設定を初期化する
   - **コードの前にテスト**: コントラクト、エンティティ、統合シナリオのテストを書く必要がある場合
   - **コア開発**: モデル、サービス、CLI コマンド、エンドポイントを実装する
   - **統合作業**: データベース接続、ミドルウェア、ロギング、外部サービス
   - **仕上げと検証**: ユニットテスト、パフォーマンス最適化、ドキュメント

8. 進捗の追跡とエラー処理:
   - 完了した各タスクの後に進捗を報告する
   - 並列でないタスクが失敗した場合は実行を停止する
   - 並列タスク [P] については、成功したタスクは続行し、失敗したものを報告する
   - デバッグのためのコンテキストとともに明確なエラーメッセージを提供する
   - 実装を続行できない場合は次のステップを提案する
   - **重要** 完了したタスクについては、タスクファイルでそのタスクを [X] としてマークすることを忘れないこと。

9. 完了の検証:
   - 必須のタスクがすべて完了していることを確認する
   - 実装された機能が元の仕様と一致することを確認する
   - テストが合格し、カバレッジが要件を満たすことを検証する
   - 実装が技術計画に従っていることを確認する

注: このコマンドは tasks.md に完全なタスク分解が存在することを前提とする。タスクが不完全または欠けている場合は、まず `/speckit-tasks` を実行してタスクリストを再生成するよう提案する。

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了しなければならない。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない、または `hooks.after_implement` 配下にフックが登録されていない場合は、Completion Report に進む。
- 存在する場合はそれを読み込み、`hooks.after_implement` キー配下のエントリを探す。
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

完了した作業のサマリーとともに最終ステータスを報告する。

## 完了条件

- [ ] tasks.md のすべてのタスクが完了し、`[X]` とマークされている
- [ ] 実装が仕様、計画、テストカバレッジに照らして検証されている
- [ ] 上記の「必須の実行後フック」のルールに従って、拡張フックがディスパッチまたはスキップされている
- [ ] 完了した作業のサマリーとともに、完了がユーザーに報告されている
