---
description: "コーディングエージェントのコンテキストファイル内の、管理対象 Spec Kit セクションを更新する"
---

# コーディングエージェントのコンテキスト更新

アクティブなコーディングエージェントのコンテキスト／指示ファイル（例: `CLAUDE.md`、`.github/copilot-instructions.md`、`AGENTS.md`）内の、管理対象 Spec Kit セクションを更新する。

## 動作

スクリプトは、agent-context 拡張の設定
`.specify/extensions/agent-context/agent-context-config.yml` を読み込み、以下を判別する:

- `context_file` — 管理するコーディングエージェントのコンテキストファイルのパス。
- `context_markers.start` / `.end` — 管理対象セクションを囲む区切り文字。フィールドがない場合は `<!-- SPECKIT START -->` と `<!-- SPECKIT END -->` がデフォルト。

その後、最新のプランパスを発見できる場合（`specs/<feature>/plan.md`）に、セクションがそれを指すように、管理対象ブロックを作成、置換、または追記する。

`context_file` が空、またはファイルが見つからない場合、コマンドは何もすることがない旨を報告し、正常に終了する。

## 実行

- **Bash**: `.specify/extensions/agent-context/scripts/bash/update-agent-context.sh [plan_path]`
- **PowerShell**: `.specify/extensions/agent-context/scripts/powershell/update-agent-context.ps1 [plan_path]`

`plan_path` が省略された場合、スクリプトは最も最近変更された `specs/*/plan.md` を自動検出する。
