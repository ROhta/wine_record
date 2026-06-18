# [PROJECT_NAME] 憲章
<!-- 例: Spec 憲章、TaskFlow 憲章 など -->

## 中核原則

### [PRINCIPLE_1_NAME]
<!-- 例: I. Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- 例: すべての機能は独立したライブラリとして始まる。ライブラリは自己完結し、単独でテスト可能で、文書化されていること。明確な目的が必須 - 組織化のためだけのライブラリは認めない -->

### [PRINCIPLE_2_NAME]
<!-- 例: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- 例: すべてのライブラリは CLI 経由で機能を公開する。テキスト入出力プロトコル: stdin/args → stdout、エラー → stderr。JSON 形式と人間が読める形式の両方をサポート -->

### [PRINCIPLE_3_NAME]
<!-- 例: III. Test-First (NON-NEGOTIABLE) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- 例: TDD 必須: テストを記述 → ユーザーが承認 → テストが失敗 → そのうえで実装。Red-Green-Refactor サイクルを厳格に強制 -->

### [PRINCIPLE_4_NAME]
<!-- 例: IV. Integration Testing -->
[PRINCIPLE_4_DESCRIPTION]
<!-- 例: 統合テストが必要な重点領域: 新しいライブラリの契約テスト、契約の変更、サービス間通信、共有スキーマ -->

### [PRINCIPLE_5_NAME]
<!-- 例: V. Observability、VI. Versioning & Breaking Changes、VII. Simplicity -->
[PRINCIPLE_5_DESCRIPTION]
<!-- 例: テキスト I/O によりデバッグ可能性を確保。構造化ログが必須。あるいは: MAJOR.MINOR.BUILD 形式。あるいは: シンプルに始める、YAGNI 原則 -->

## [SECTION_2_NAME]
<!-- 例: 追加の制約、セキュリティ要件、パフォーマンス基準 など -->

[SECTION_2_CONTENT]
<!-- 例: 技術スタック要件、コンプライアンス基準、デプロイポリシー など -->

## [SECTION_3_NAME]
<!-- 例: 開発ワークフロー、レビュープロセス、品質ゲート など -->

[SECTION_3_CONTENT]
<!-- 例: コードレビュー要件、テストゲート、デプロイ承認プロセス など -->

## ガバナンス
<!-- 例: 憲章は他のすべての慣行に優先する。改訂には文書化、承認、移行計画が必要 -->

[GOVERNANCE_RULES]
<!-- 例: すべての PR/レビューは準拠を検証しなければならない。複雑さは正当化されなければならない。ランタイムの開発ガイダンスには [GUIDANCE_FILE] を使用する -->

**バージョン**: [CONSTITUTION_VERSION] | **制定日**: [RATIFICATION_DATE] | **最終改定日**: [LAST_AMENDED_DATE]
<!-- 例: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
