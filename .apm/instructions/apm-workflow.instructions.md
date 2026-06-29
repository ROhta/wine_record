---
description: APM (Agent Package Manager) を介した AI エージェント指示の運用ルール
applyTo: ".apm/**"
---

# APM 運用ルール

## Source of Truth

`.apm/instructions/*.instructions.md` がすべての AI エージェント向け指示の Source of Truth。ここを編集し `apm install` / `apm compile` を実行すると、GitHub Copilot・Codex 向けの生成物に同じ指示が反映される。

## ファイルの管理方針

| パス | 役割 | リポジトリ追跡 |
| --- | --- | --- |
| `.apm/instructions/*.instructions.md` | **Source of Truth（instructions・人間が編集）** | ✅ 追跡する |
| `apm.yml` | **Source of Truth（targets・MCP・依存・人間が編集）** | ✅ 追跡する |
| `apm.lock.yaml` | `apm install` で生成（再現性のため例外的に追跡） | ✅ 追跡する |
| `.github/copilot-instructions.md` | Copilot Code Review に SoT への参照を伝えるスタブ（人間が編集） | ✅ 追跡する |
| `.github/instructions/*.instructions.md` | `apm install`/`compile` で生成（GitHub Copilot 用） | ❌ 追跡しない |
| `AGENTS.md`（各所） | `apm compile` で生成（Codex 等） | ❌ 追跡しない |
| `.codex/`・`.vscode/mcp.json`・`.mcp.json` | `apm install` で生成（MCP・エージェント設定） | ❌ 追跡しない |
| `apm_modules/` ほか APM プラグイン展開先 | `apm install` で生成 | ❌ 追跡しない |

> **CLAUDE.md は APM 管理外**。本プロジェクトは Spec Kit を併用しており、`CLAUDE.md` は Spec Kit（`speckit-agent-context-update`）が `<!-- SPECKIT START/END -->` ブロックで管理する。二重管理と上書き衝突を避けるため、`apm.yml` の `targets` から `claude` を**意図的に除外**している（APM は CLAUDE.md / `.claude/` を生成・上書きしない）。Claude Code 向けの指示は CLAUDE.md とスキルで供給する。

## ローカルでの作業

`.apm/instructions/` または `apm.yml` を編集したら、ローカルで以下を実行して生成物を更新する。

```bash
apm install   # プリミティブを再デプロイ（.github/instructions/ ほか）＋ apm.lock.yaml を更新
apm compile   # AGENTS.md（Codex 等）を更新
```

`apm.lock.yaml` を除く生成物は `.gitignore` 対象のためコミットには含まれない。`apm compile` は既定で Spec Kit の constitution ブロックを取り込む（`--with-constitution`）。

## GitHub Copilot Code Review への指示伝達

GitHub Copilot Code Review エージェントは `AGENTS.md` を読まず、`.github/copilot-instructions.md` または `.github/instructions/*.instructions.md` のみを読む。本リポジトリでは `.github/copilot-instructions.md` をスタブとして配置し、SoT である `.apm/instructions/pr-review.instructions.md` を参照させている。

参考:

- <https://docs.github.com/copilot/how-tos/configure-custom-instructions/add-repository-instructions>
