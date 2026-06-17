# 実装計画: [FEATURE]

**ブランチ**: `[###-feature-name]` | **日付**: [DATE] | **仕様**: [link]

**入力**: `/specs/[###-feature-name]/spec.md` の機能仕様

**注**: このテンプレートは `/speckit-plan` コマンドによって埋められます。実行ワークフローについては `.specify/templates/plan-template.md` を参照してください。

## 概要

[機能仕様から抽出: 主要要件 + 調査に基づく技術的アプローチ]

## 技術コンテキスト

<!--
  対応が必要: このセクションの内容を、プロジェクトの技術的詳細に置き換える。
  ここでの構造は、反復プロセスを導くための参考として提示している。
-->

**言語/バージョン**: [例: Python 3.11、Swift 5.9、Rust 1.75、または NEEDS CLARIFICATION]

**主要な依存**: [例: FastAPI、UIKit、LLVM、または NEEDS CLARIFICATION]

**ストレージ**: [該当する場合、例: PostgreSQL、CoreData、ファイル、または N/A]

**テスト**: [例: pytest、XCTest、cargo test、または NEEDS CLARIFICATION]

**対象プラットフォーム**: [例: Linux サーバー、iOS 15+、WASM、または NEEDS CLARIFICATION]

**プロジェクト種別**: [例: library/cli/web-service/mobile-app/compiler/desktop-app、または NEEDS CLARIFICATION]

**性能目標**: [ドメイン固有、例: 1000 req/s、10k lines/sec、60 fps、または NEEDS CLARIFICATION]

**制約**: [ドメイン固有、例: <200ms p95、<100MB メモリ、オフライン対応、または NEEDS CLARIFICATION]

**規模/範囲**: [ドメイン固有、例: 10k ユーザー、1M LOC、50 画面、または NEEDS CLARIFICATION]

## 憲章チェック

*GATE: Phase 0 の調査前に通過しなければならない。Phase 1 の設計後に再チェックする。*

[憲章ファイルに基づいて決定されるゲート]

## プロジェクト構成

### ドキュメント (この機能)

```text
specs/[###-feature]/
├── plan.md              # このファイル (/speckit-plan コマンドの出力)
├── research.md          # Phase 0 の出力 (/speckit-plan コマンド)
├── data-model.md        # Phase 1 の出力 (/speckit-plan コマンド)
├── quickstart.md        # Phase 1 の出力 (/speckit-plan コマンド)
├── contracts/           # Phase 1 の出力 (/speckit-plan コマンド)
└── tasks.md             # Phase 2 の出力 (/speckit-tasks コマンド - /speckit-plan では作成されない)
```

### ソースコード (リポジトリルート)
<!--
  対応が必要: 以下のプレースホルダのツリーを、この機能の具体的なレイアウトに置き換える。
  使わない選択肢は削除し、選んだ構造を実際のパス (例: apps/admin、packages/something) で展開する。
  納品する計画には Option ラベルを含めてはならない。
-->

```text
# [未使用なら削除] Option 1: 単一プロジェクト (デフォルト)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [未使用なら削除] Option 2: Web アプリケーション ("frontend" + "backend" が検出された場合)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [未使用なら削除] Option 3: モバイル + API ("iOS/Android" が検出された場合)
api/
└── [上記の backend と同じ]

ios/ or android/
└── [プラットフォーム固有の構造: 機能モジュール、UI フロー、プラットフォームテスト]
```

**構造の決定**: [選択した構造を文書化し、上記で捕捉した実際の
ディレクトリを参照する]

## 複雑さの追跡

> **憲章チェックに、正当化が必要な違反がある場合のみ記入する**

| 違反 | なぜ必要か | より単純な代替案を却下した理由 |
|-----------|------------|-------------------------------------|
| [例: 4つ目のプロジェクト] | [現在の必要性] | [なぜ3つのプロジェクトでは不十分か] |
| [例: Repository パターン] | [具体的な問題] | [なぜ直接 DB アクセスでは不十分か] |
