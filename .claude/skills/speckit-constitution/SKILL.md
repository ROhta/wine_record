---
name: "speckit-constitution"
description: "対話的に、または提供された原則の入力からプロジェクト憲章を作成・更新し、依存するすべてのテンプレートが同期した状態を保つようにする。"
argument-hint: "プロジェクト憲章のための原則または価値観"
compatibility: ".specify/ ディレクトリを持つ spec-kit プロジェクト構造が必要"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/constitution.md"
user-invocable: true
disable-model-invocation: false
---


## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力を（空でない場合）**必ず**考慮しなければならない。

## 実行前チェック

**拡張フックの確認（憲章の更新前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.before_constitution` キー配下のエントリを探す
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

あなたは `.specify/memory/constitution.md` にあるプロジェクト憲章を更新している。このファイルは、角括弧で囲まれたプレースホルダトークン（例: `[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]`）を含む TEMPLATE である。あなたの仕事は、(a) 具体的な値を収集／導出し、(b) テンプレートを正確に埋め、(c) すべての修正を依存する成果物全体に伝播させることである。

**注**: `.specify/memory/constitution.md` がまだ存在しない場合、プロジェクトのセットアップ時に `.specify/templates/constitution-template.md` から初期化されているはずである。もし見当たらなければ、まずテンプレートをコピーすること。

この実行フローに従うこと:

1. `.specify/memory/constitution.md` にある既存の憲章を読み込む。
   - `[ALL_CAPS_IDENTIFIER]` 形式のプレースホルダトークンをすべて特定する。
   **重要**: ユーザーはテンプレートで使われているものより少ない、または多い原則を求めることがある。数が指定されている場合はそれを尊重し、全体的なテンプレートに従うこと。それに応じてドキュメントを更新する。

2. プレースホルダの値を収集／導出する:
   - ユーザー入力（会話）が値を提供している場合は、それを使う。
   - そうでない場合は、既存のリポジトリのコンテキスト（README、ドキュメント、埋め込まれていれば以前の憲章のバージョン）から推測する。
   - ガバナンス日付について: `RATIFICATION_DATE` は最初の採択日（不明な場合は尋ねるか TODO とマークする）、`LAST_AMENDED_DATE` は変更が行われた場合は本日、そうでなければ以前の値を維持する。
   - `CONSTITUTION_VERSION` はセマンティックバージョニングのルールに従ってインクリメントしなければならない:
     - MAJOR: 後方互換性のないガバナンス／原則の削除または再定義。
     - MINOR: 新しい原則／セクションの追加、または実質的に拡張されたガイダンス。
     - PATCH: 明確化、言い回し、誤字修正、意味を変えない調整。
   - バージョン引き上げの種類が曖昧な場合は、確定する前に根拠を提示する。

3. 更新後の憲章の内容を起草する:
   - すべてのプレースホルダを具体的なテキストに置き換える（プロジェクトがまだ定義しないことを選んだ意図的に保持されたテンプレート枠を除き、角括弧トークンを残さない。残すものはすべて明示的に正当化すること）。
   - 見出しの階層を維持する。置き換え済みのコメントは、まだ明確化のためのガイダンスを加えていない限り削除してよい。
   - 各原則セクションが次を満たすようにする: 簡潔な名前行、譲れないルールを捉えた段落（または箇条書き）、自明でない場合は明示的な根拠。
   - ガバナンスセクションが、修正手続き、バージョニング方針、コンプライアンスレビューの期待事項を列挙していることを確認する。

4. 一貫性伝播チェックリスト（以前のチェックリストを能動的な検証に変換する）:
   - `.specify/templates/plan-template.md` を読み、あらゆる「Constitution Check」やルールが更新後の原則と整合していることを確認する。
   - `.specify/templates/spec-template.md` をスコープ／要件の整合性について読み、憲章が必須セクションや制約を追加／削除した場合は更新する。
   - `.specify/templates/tasks-template.md` を読み、タスクの分類が新規または削除された原則由来のタスク種別（例: 可観測性、バージョニング、テスト規律）を反映していることを確認する。
   - `.specify/templates/commands/*.md` の各コマンドファイル（このファイルを含む）を読み、汎用的なガイダンスが必要な箇所に時代遅れの参照（CLAUDE のようなエージェント固有の名前のみ）が残っていないことを確認する。
   - 実行時ガイダンスのドキュメント（例: `README.md`、`docs/quickstart.md`、または存在すればエージェント固有のガイダンスファイル）を読む。変更された原則への参照を更新する。

5. Sync Impact Report を作成する（更新後、憲章ファイルの先頭に HTML コメントとして先頭に付ける）:
   - バージョン変更: 旧 → 新
   - 変更された原則のリスト（名前変更された場合は旧タイトル → 新タイトル）
   - 追加されたセクション
   - 削除されたセクション
   - 更新が必要なテンプレート（✅ 更新済み / ⚠ 保留）とファイルパス
   - プレースホルダを意図的に先送りした場合のフォローアップ TODO。

6. 最終出力前の検証:
   - 説明のない角括弧トークンが残っていないこと。
   - バージョン行がレポートと一致していること。
   - 日付が ISO 形式 YYYY-MM-DD であること。
   - 原則が宣言的かつテスト可能で、曖昧な表現がないこと（「should」→ 適切な箇所で MUST/SHOULD の根拠に置き換える）。

7. 完成した憲章を `.specify/memory/constitution.md` に書き戻す（上書き）。

8. ユーザーに最終サマリーを出力する:
   - 新しいバージョンと引き上げの根拠。
   - 手動でのフォローアップが必要としてフラグが立てられたファイル。
   - 推奨コミットメッセージ（例: `docs: amend constitution to vX.Y.Z (principle additions + governance update)`）。

書式とスタイルの要件:

- Markdown の見出しはテンプレートと完全に同じに使う（レベルを下げたり上げたりしない）。
- 長い根拠の行は読みやすさを保つために折り返す（理想は 100 文字未満）が、不自然な改行で無理に強制しない。
- セクション間は空行 1 行を保つ。
- 行末の空白を避ける。

ユーザーが部分的な更新（例: 1 つの原則の改訂だけ）を提供した場合でも、検証とバージョン決定のステップは実行すること。

重要な情報が欠けている場合（例: 批准日が本当に不明）、`TODO(<FIELD_NAME>): explanation` を挿入し、Sync Impact Report の先送り項目として含めること。

新しいテンプレートを作成しないこと。常に既存の `.specify/memory/constitution.md` ファイルに対して操作する。

## 実行後チェック

**拡張フックの確認（憲章の更新後）**:
プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み込み、`hooks.after_constitution` キー配下のエントリを探す
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

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
- フックが何も登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする
