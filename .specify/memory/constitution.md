<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Ratification: initial adoption
- Modified principles: all placeholders replaced with concrete principles
- Added sections:
  - Core Principles I–V
  - Security & Secrets
  - Development Workflow
  - Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check aligns: TDD gate, type-safety gate, semantic/structured gate)
  - ✅ .specify/templates/spec-template.md (no mandatory section change required)
  - ✅ .specify/templates/tasks-template.md (test-first task ordering matches Principle II)
- Follow-up TODOs: none
-->

# Wine Record Constitution

## Core Principles

### I. MCP-First Contract Clarity
すべての機能は MCP のツール / リソース / ウィジェットとして公開する。各ツールは
入力・出力スキーマを明示し（バリデーション必須）、副作用と前提を文書化する。
接続クライアント（Claude / Codex モバイル）から見た契約が唯一の真実であり、
内部実装はこの契約を壊さずに差し替え可能でなければならない。
Rationale: クライアントが LLM であり、曖昧な契約は誤呼び出しに直結するため。

### II. Test-First (NON-NEGOTIABLE)
TDD を厳守する。テストを先に書き、失敗を確認してから実装する
（Red → Green → Refactor）。ツールのハンドラ、観点別クエリのランキング、
タクソノミー解析など、ロジックを持つ単位は必ず先行テストを持つ。
Rationale: LLM 経由で呼ばれる API は手動確認がしづらく、回帰検知を自動化する必要があるため。

### III. Strict Type Safety
TypeScript を `@tsconfig/strictest` 相当で運用する。`any` の使用は禁止
（やむを得ない場合は理由をコメントで明示）。外部入力（OCR 抽出値・クライアント
入力・ストレージ応答）は境界で型検証してから内部型に変換する。
Rationale: 型が契約とデータ整合性の第一の防御線になるため。

### IV. Semantic vs Structured Separation
検索の観点は「意味的近さ」と「構造的近さ」に分離して実装する。
香り・外観・味わいの近さは埋め込みベクトル検索で、産地・ヴィンテージの近さは
メタデータの階層一致・数値近接で扱う。構造的近接をベクトル距離で代替してはならない。
Rationale: ヴィンテージや産地の「近さ」を埋め込み距離で測ると意味をなさず、
「観点別提示」機能が静かに壊れるため。

### V. Vertical-Slice Scope & YAGNI
機能は端から端まで動く薄い縦切りで届ける。投機的な一般化や未使用の抽象を作らない。
最初のスコープ（記録フロー）が端から端まで動くことを、横展開より優先する。
Rationale: 動く最小単位を積み上げる方が、リスクと手戻りを最小化できるため。

## Security & Secrets

- Upstash / オブジェクトストレージのトークンや API キーは環境変数で管理し、
  リポジトリ・ログ・エラーメッセージに出さない。
- 署名付きアップロード URL は短命（数分）かつ単一用途とする。
- リモート MCP の HTTP 層はセキュアヘッダ（Helmet 等）を既定で適用する。
- 外部入力（画像由来の抽出テキスト含む）は信頼境界の外として検証する。

## Development Workflow

- ブランチを切って作業し、`main` へ直接コミットしない。
- 各タスク / 論理単位ごとにコミットする。
- PR / レビューでは本憲章の各原則への準拠を確認する。
- 複雑性の追加は Complexity Tracking で正当化する（より単純な代替を却下した理由を記す）。
- speckit の正規フロー（constitution → specify → plan → tasks → implement）に従う。

## Governance

本憲章はプロジェクトの他のあらゆる慣行に優先する。改定には、変更内容の文書化・
レビュー承認・必要なら移行計画を要する。バージョンはセマンティックバージョニングに従う
（MAJOR: 原則の削除・非互換な再定義、MINOR: 原則 / セクションの追加・実質的拡張、
PATCH: 字句・明確化）。全 PR / レビューは準拠を検証し、逸脱は Complexity Tracking で
正当化されない限り却下する。ランタイムの開発ガイダンスは各機能の plan.md を参照する。

**Version**: 1.0.0 | **Ratified**: 2026-06-17 | **Last Amended**: 2026-06-17
