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
| `CLAUDE.md` | `apm compile` で生成（Claude Code 用・constitution 込み） | ❌ 追跡しない |
| `AGENTS.md`（各所） | `apm compile` で生成（Codex 等） | ❌ 追跡しない |
| `.github/instructions/*.instructions.md` | `apm install`/`compile` で生成（GitHub Copilot 用） | ❌ 追跡しない |
| `.claude/rules/*.md` | `apm install` で生成（Claude Code 補助） | ❌ 追跡しない |
| `.codex/`・`.vscode/mcp.json`・`.mcp.json` | `apm install` で生成（MCP・エージェント設定） | ❌ 追跡しない |
| `apm_modules/` ほか APM プラグイン展開先 | `apm install` で生成 | ❌ 追跡しない |
| `.claude/skills/*` | Spec Kit スキル（APM 生成物ではない） | ✅ 追跡する |

> **CLAUDE.md / `.claude/rules/` は APM 生成物**（gitignore・追跡しない）。`apm.yml` の `targets` に `claude` を含め、`apm compile` が `.apm/instructions/` ＋ 憲章（`--with-constitution`）から CLAUDE.md を生成する。
>
> Spec Kit の現プランポインタ（旧 `<!-- SPECKIT START/END -->` ブロック）は、`agent-context-config.yml` の `context_file` を `.apm/instructions/spec-context.instructions.md` に向けることで**そこへ書かれ**、`apm compile` が CLAUDE.md / AGENTS.md / `.github/instructions` に畳み込む。これにより「Spec Kit と APM が同じ CLAUDE.md を奪い合う」衝突を避けつつ動的なプランポインタを維持する。**speckit の plan/specify を実行したら `apm compile` を1回回して反映する。**
>
> 注: `.claude/skills/`（Spec Kit スキル）は APM 生成物ではなく追跡対象。`.claude/rules/` のみ生成物として無視する。

## ローカルでの作業

`.apm/instructions/` または `apm.yml` を編集したら、ローカルで以下を実行して生成物を更新する。

```bash
apm install   # プリミティブ再デプロイ（.github/instructions/・.claude/rules/）＋ apm.lock.yaml 更新
apm compile   # CLAUDE.md / AGENTS.md を更新
```

`apm.lock.yaml` を除く生成物は `.gitignore` 対象のためコミットには含まれない。`apm compile` は既定で Spec Kit の constitution ブロックを取り込む（`--with-constitution`）。

## GitHub Copilot Code Review への指示伝達

GitHub Copilot Code Review エージェントは `AGENTS.md` を読まず、`.github/copilot-instructions.md` または `.github/instructions/*.instructions.md` のみを読む。本リポジトリでは `.github/copilot-instructions.md` をスタブとして配置し、SoT である `.apm/instructions/pr-review.instructions.md` を参照させている。

参考:

- <https://docs.github.com/copilot/how-tos/configure-custom-instructions/add-repository-instructions>
