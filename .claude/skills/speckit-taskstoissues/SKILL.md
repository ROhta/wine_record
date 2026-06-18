---
name: "speckit-taskstoissues"
description: "利用可能な設計成果物に基づき、既存のタスクを、その機能向けの実行可能で依存関係順に並んだ GitHub issue に変換する。"
argument-hint: "GitHub issue のフィルタまたはラベル（任意）"
compatibility: ".specify/ ディレクトリを含む spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/taskstoissues.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

先に進む前に、ユーザー入力を（空でなければ）**必ず**考慮すること。

## 実行前チェック

**拡張フックの確認（tasks-to-issues 変換の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合、それを読み込み `hooks.before_taskstoissues` キー配下のエントリを探す
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

    概要に進む前にフックコマンドの結果を待つこと。
    ```
- フックが1つも登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙って省略する

## 概要

1. リポジトリルートから `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` を実行し、FEATURE_DIR と AVAILABLE_DOCS のリストをパースする。すべてのパスは絶対パスでなければならない。"I'm Groot" のように引数にシングルクォートを含む場合は、エスケープ構文を使う: 例 'I'\''m Groot'（または可能なら二重引用符で囲む: "I'm Groot"）。
1. **存在する場合**: プロジェクトの原則とガバナンス制約のために `.specify/memory/constitution.md` を読み込む。
1. 実行したスクリプトから、**tasks** へのパスを抽出する。
1. 次を実行して Git リモートを取得する:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> リモートが GitHub の URL である場合のみ、次の手順に進むこと

1. リストの各タスクについて、GitHub MCP サーバーを使い、Git リモートに対応するリポジトリに新しい issue を作成する。

> [!CAUTION]
> いかなる状況でも、リモート URL に一致しないリポジトリに issue を作成しないこと

## 実行後チェック

**拡張フックの確認（tasks-to-issues 変換の後）**:
プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合、それを読み込み `hooks.after_taskstoissues` キー配下のエントリを探す
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
