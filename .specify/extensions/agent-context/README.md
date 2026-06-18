# Coding Agent Context拡張

このバンドルされた拡張は、有効な統合に対する**コーディングエージェントのコンテキスト/指示ファイル**(例: `CLAUDE.md`、`.github/copilot-instructions.md`、`AGENTS.md`、`GEMINI.md` …)を管理します。

設定可能な開始/終了マーカー(デフォルト: `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->`)で区切られた、管理対象セクションのライフサイクルを担います。

## なぜ拡張なのか?

すべての Spec Kit ユーザーが、Spec Kit にコーディングエージェントのコンテキストファイルへ書き込んでほしいわけではありません。この振る舞いを専用の拡張に切り出すことで、ユーザーは次のことができます:

- **完全にオプトアウトする**: `specify extension disable agent-context` を実行すると、Spec Kit はエージェントのコンテキストファイルを作成・変更しなくなります。
- **マーカーをカスタマイズする**: `.specify/extensions/agent-context/agent-context-config.yml` を編集します。Python レイヤーとバンドルされたスクリプトの両方が同じ `context_markers` の値を尊重します。
- **オンデマンドで更新する**: `/speckit.agent-context.update` を使うか、`extension.yml` で宣言されたフック(`after_specify`、`after_plan`)を通じて自動的に更新します。

## コマンド

| コマンド | 説明 |
|---------|-------------|
| `speckit.agent-context.update` | エージェントのコンテキストファイル内の管理対象セクションを、現在のプランのパスで更新します。 |

## 設定

すべての設定は、拡張独自の設定ファイル
`.specify/extensions/agent-context/agent-context-config.yml` を通じて行われます:

```yaml
# この拡張が管理するコーディングエージェントのコンテキストファイルへのパス
context_file: CLAUDE.md

# 管理対象の Spec Kit セクションを区切る区切り文字
context_markers:
  start: "<!-- SPECKIT START -->"
  end: "<!-- SPECKIT END -->"
```

- `context_file` — コーディングエージェントのコンテキストファイルへのプロジェクト相対パス。`specify init` と `specify integration install` によって書き込まれます。
- `context_markers.start` / `.end` — 管理対象セクションを囲む区切り文字。カスタムマーカーを使うにはこれらを編集します。

## 要件

バンドルされた更新スクリプトは、YAML/upsert 処理のために **PyYAML** を備えた **Python 3** を必要とします(利用可能な場合、PowerShell は `ConvertFrom-Yaml` も使えます)。

PyYAML は `specify` CLI に同梱されており、通常は同じ `python3` インタプリタ経由で利用できます。フックが *"PyYAML is required … not available in the current Python environment"* と報告した場合、それはシステムの `python3` が Spec Kit のインストールに使われたものと異なることを意味します。解決するには、次を実行します:

```bash
pip install pyyaml
# または、Spec Kit が使う特定のインタプリタを対象にする:
/path/to/speckit-python -m pip install pyyaml
```

## 無効化

```bash
specify extension disable agent-context
```

無効化すると、Spec Kit はコンテキストファイルの作成・更新・削除をスキップします(そのゲートは `upsert_context_section()` と `remove_context_section()` の内部にあります)。
