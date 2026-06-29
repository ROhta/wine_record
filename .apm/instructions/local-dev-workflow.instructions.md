---
description: ローカル開発フロー（機能開発は Spec Kit、実装完了から PR 作成・レビュー応答ループまで）
applyTo: "**"
---

# ローカル開発ワークフロー（AI エージェント向け）

このプロジェクトでローカル開発を進める AI エージェントは、以下のワークフローに従う。

## 0. 機能開発は Spec Kit で進める

新機能や大きめの変更は **Spec Kit** のフローで進める（superpowers 系スキルは使わない）。

`speckit-constitution`（必要時）→ `speckit-specify` → `speckit-plan` → `speckit-tasks` →（任意 `speckit-taskstoissues`）→ `speckit-implement`。

- 仕様・計画・タスクは `specs/<NNN-feature>/` に置かれる（パスは Spec Kit が管理。手で別所へ動かさない）。
- プロジェクト原則は `.specify/memory/constitution.md`。
- ドキュメント・設定・依存更新などの小さな雑務は、Spec Kit を通さずブランチ + PR で直接進めてよい。

## 1. ブランチとコミット

- **`main` に直接コミットしない**。作業ごとにブランチを切る（例: `chore/...`、`NNN-feature-...`）。
- コミットメッセージは Conventional Commits 形式（`<type>(<scope>): <説明>`）、本文は日本語。
- コミット末尾のトレーラ（`Co-Authored-By:` / `Claude-Session:`）は Claude Code 環境が自動付与する。手で削除しない。

## 2. 実装完了 → PR 作成

実装が完了したと判断したら、順に実行する。**前ステップが完了するまで次に進まない。**

1. **品質ゲートを完遂**する: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`。失敗したら根本原因を解決してから次へ。
2. ブランチを push し、PR を作成する。
   - PR 本文は [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) の項目（`## 期待する挙動・状態` / `## 確認済み項目` / `## 見てほしいところ`）を埋める。
   - チェックボックスはコミット前に検証済みの項目のみ `[x]`、Preview デプロイ待ちなど未確認のものは `[ ]` のまま残す。
   - PR タイトルは Conventional Commits 形式で、本文と同じく日本語で書く。
   - PR の assignee に、現在の `gh` CLI 認証ユーザーを設定する（`gh pr create --assignee @me`、または作成後に `gh pr edit <pr> --add-assignee @me`）。

## 3. PR レビュー応答ループ（PR 作成 / push 毎）

PR を新規作成、または既存ブランチに push した後、**ユーザーからの合図を待たずに**自走でレビュースレッドの有無を確認し、指摘があれば対応する。**すべてのスレッドが resolve されるまでループを継続する。**

### 3.0 起動

`gh pr create` または `git push` の成功直後に本フローを開始する（ユーザー入力を待たない）。

- **即時 1 回**: push 完了から約 2 分（120 秒）待機（Copilot Review の初回反応待ち）し、§3.1 を 1 回実行する。
- **追跡（Claude Code）**: 指摘は遅延することがあるため、`ScheduleWakeup` でさらに 2 分後にもう 1 回フォローする。即時 + 追跡で**連続 2 回**新規指摘がなければ追跡を終了する。

  ```text
  ScheduleWakeup({ delaySeconds: 120,
    prompt: "PR #<番号> の Copilot Review 応答ループを再開する。.apm/instructions/local-dev-workflow.instructions.md §3 に従い、未 resolve スレッドを検知して処理せよ。",
    reason: "Copilot Review 遅延応答の追跡チェック（push から 2 分後）" })
  ```

- **ユーザー復帰時フォールバック**: 次にユーザー入力を受け取ったとき、その入力が PR と無関係に見えても、まず自分の未マージ PR の未 resolve スレッドを 1 回確認する。あれば「PR #<番号> に未対応のレビュースレッドがあります。先に応答しますか？」と確認し、了承されたら §3.1〜3.3 を先に実行する。

### 3.1 検知

`gh api graphql` で未 resolve なレビュースレッドを列挙する（`gh pr view --json reviews` は `isResolved` を返さないので使わない）。

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
    reviewThreads(first:100){ nodes{
      id            # resolveReviewThread の threadId に渡す Node ID
      isResolved
      comments(first:50){ nodes{
        databaseId  # REST の comment_id（返信先）に渡す数値 ID
        author{login} body path line
      } }
    } } } }
}' -F owner=ROhta -F repo=wine_record -F pr=<番号>
```

対象は `isResolved: false` かつ先頭コメント（`comments.nodes[0]`）の `author.login` が bot（例: `copilot-pull-request-reviewer`）のスレッドのみ。

### 3.2 妥当性判断

各指摘を次のいずれかに分類する。

- **妥当**: 反映すべき具体的かつ正当な指摘
- **不当**: 文脈上採用すべきでない、誤読、二重指摘 等

### 3.3 対応

#### 妥当な指摘

1. 指摘に従ってコードを修正する。
2. 修正をコミットする。
3. 該当インラインコメントに返信する。本文は日本語で、対応コミットの SHA を**前後に半角空白を入れて**記載する（GitHub UI でコミットリンクに描画される）。

   ```bash
   gh api repos/ROhta/wine_record/pulls/<pr>/comments/<databaseId>/replies -f body='対応しました abc1234 '
   ```

   - `<databaseId>` は §3.1 の `databaseId`（**数値 ID**）。GraphQL Node ID（`PRRC_...`）は REST では受け付けられない。
4. スレッドを resolve する。

   ```bash
   gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' -F id=<thread_node_id>
   ```

#### 不当と判断した場合

1. コードは変更しない。
2. インラインコメントで「不当と判断した理由」を日本語で具体的に記載する。
3. スレッドを resolve する（上記 mutation）。

### 3.4 繰り返し

- 全スレッドを resolve するまで 3.1〜3.3 をループする。
- 次の `git push` が発生したら、再度 3.1 から実行する。

## 関連ルール

- レビュー応答の文章ルール: [`pr-review.instructions.md`](./pr-review.instructions.md)
- 環境構築・コマンド: [`setup.instructions.md`](./setup.instructions.md)
