---
description: "MCP コネクタ OAuth 認証（Auth0）のタスクリスト"
---

# タスク: MCP コネクタの OAuth 認証（claude.ai 接続）

**入力**: `/specs/002-mcp-oauth-auth/` の設計ドキュメント
**前提**: plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md（すべて作成済み）
**テスト**: 機能仕様で明示要求（FR-012）＋ 憲章 II（TDD・交渉の余地なし）。**テストタスクは必須**。
**構成方針**: ユーザーストーリー（US1/US2/US3）ごとに独立検証可能な単位で分割。

## フォーマット: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可能（異なるファイル・依存関係なし）
- **[Story]**: US1（認証付き接続）/ US2（認証済み記録）/ US3（未認証拒否）

## パスの規約

- 単一プロジェクト: リポジトリルートの `src/`・`tests/`・`iac/`。plan.md の構成に従う。

---

## Phase 1: セットアップ（共有インフラ）

**目的**: 依存追加と設定の土台。

- [X] T001 `express-oauth2-jwt-bearer` を追加する（`gh api repos/auth0/node-oauth2-jwt-bearer/releases/latest --jq '.tag_name'` で最新版を確認し）`package.json` の dependencies に入れて `npm install`。`npm run build`/`typecheck` が通ることを確認。
- [X] T002 `src/config.ts` の `EnvSchema` と `Config` に Auth0 設定を追加する（`AUTH0_ISSUER_BASE_URL`・`AUTH0_AUDIENCE` を任意、`Config.auth: {issuerBaseUrl, audience} | null`）。**両方設定で認証 ON / 両方未設定で OFF / 片方のみはエラー**。値はログ・エラーに出さない（憲章）。
- [X] T003 [P] `.env.example` に `AUTH0_ISSUER_BASE_URL` / `AUTH0_AUDIENCE` を追記する（プレースホルダ＋「本番では必須」コメント）。

---

## Phase 2: 基盤（ブロッキングな前提条件）

**目的**: 全ストーリーが依存する「注入可能な認証シーム」を用意する。env OFF では既存挙動（52 テスト緑）を壊さない。

**⚠️ CRITICAL**: このフェーズ完了まで US1〜US3 の作業は開始できない。

- [X] T004 [P] `tests/unit/authConfig.test.ts` を作成する（**先に書いて落とす**）。`loadConfig` の Auth0 設定: 両方あり→`auth` 生成 / 両方なし→`auth=null` / 片方のみ→throw、を検証（env 注入で）。
- [X] T005 T004 を満たすよう `src/config.ts` を実装する（T002 の検証ルールを Green に）。
- [X] T006 `src/auth/tokenVerifier.ts` に `TokenVerifier` インターフェースと結果型を定義する（`verify(authorizationHeader): Promise<{ok:true, subject, scopes} | {ok:false, reason}>`）。テストで差し替え可能な注入シームにする（実体は US1 で Auth0 実装）。
- [X] T007 `src/server.ts` の `createApp(deps)` / `buildExpressApp(resolveDeps)` に **任意の `tokenVerifier`** を受け取れるよう配線する（未指定＝認証 OFF で従来どおり通過。`/health` は常に認証外）。この時点では `/mcp` のゲートは「verifier があれば検証、無ければ素通し」の骨組みのみ。既存 52 テストが緑のまま維持されることを確認。

**チェックポイント**: 認証シーム導入済み・既存挙動不変。ストーリー実装を開始できる。

---

## Phase 3: ユーザーストーリー 1 - 認証付きでコネクタを接続する（優先度: P1）🎯 MVP

**ゴール**: 未認証は 401 + 認証案内、メタデータ公開、有効トークンでツール一覧取得まで成立。

**独立したテスト**: env 注入のフェイク検証器で、未認証 /mcp→401+WWW-Authenticate / well-known→RFC9728 JSON / 有効トークン→tools/list 通過、を結合テストで検証（実 Auth0 不要）。

### US1 テスト（実装前に書いて落とす）⚠️

- [X] T008 [P] [US1] `tests/unit/protectedResourceMetadata.test.ts` を作成する。与えた `Config.auth` から RFC 9728 JSON（`resource`=audience / `authorization_servers`=[issuerBaseUrl]）が生成されることを検証（contracts/protected-resource-metadata.md）。
- [X] T009 [P] [US1] `tests/unit/wwwAuthenticate.test.ts` を作成する。`Bearer resource_metadata="<URL>"` のヘッダ書式を検証（contracts/auth-http-contract.md C1）。
- [X] T010 [US1] `tests/integration/authGate.test.ts` を作成する（フェイク検証器を注入）。(a) 未認証 POST /mcp→401＋WWW-Authenticate、(b) GET /.well-known/oauth-protected-resource[/mcp]→200 JSON、(c) 有効トークン→initialize/tools/list 通過、(d) /health→200（認証外）。

### US1 実装

- [X] T011 [P] [US1] `src/auth/protectedResourceMetadata.ts` を実装する（T008 を Green に）。`Config.auth` から RFC 9728 JSON を生成する純関数。
- [X] T012 [P] [US1] `src/auth/wwwAuthenticate.ts` を実装する（T009 を Green に）。401 応答に付与する `WWW-Authenticate` 値を生成。
- [X] T013 [US1] `src/auth/tokenVerifier.ts` に `createAuth0Verifier(config)` を実装する。`express-oauth2-jwt-bearer` の `auth({issuerBaseURL, audience})` をラップし RS256/JWKS/iss/aud/exp を検証、`req.auth.payload` を内部型へ変換。検証失敗は `{ok:false}`。
- [X] T014 [US1] `src/server.ts` を実装する（T010 を Green に）。(a) `/.well-known/oauth-protected-resource` と `/.well-known/oauth-protected-resource/mcp` ルートを追加（認証外）、(b) `/mcp` で verifier 検証→失敗時 401＋WWW-Authenticate（秘匿情報なし）、(c) `buildDeps`/`createServerlessApp` で `config.auth` があれば `createAuth0Verifier` を注入。Helmet 既定は維持。
- [X] T015 [US1] 全ゲート（typecheck/lint/format:check/test/build）が緑であることを確認する。

**チェックポイント**: 認証ゲートが自動テストで成立（claude.ai 実機は US2 のインフラ完了後）。

---

## Phase 4: ユーザーストーリー 2 - 認証済みでワインを記録する（優先度: P1）

**ゴール**: 実 Auth0 + 本番デプロイで、claude.ai から OAuth 同意 → record_wine 往復 → 永続化。

**独立したテスト**: 有効トークン（フェイク検証器）でゲートを通過し record_wine が永続化まで到達することを結合テストで確認。実機は claude.ai で往復。

### US2 テスト

- [X] T016 [US2] `tests/integration/authGate.test.ts` に「有効トークン→record_wine がゲートを通り、フェイクストアに 1 件 upsert される」ケースを追加する（既存ツール挙動が認証通過後は不変＝FR-008 を担保）。

### US2 実装・インフラ（手動設定を含む）

- [ ] T017 [US2] **Auth0 テナント設定**（quickstart.md ステップ1・手動・**DCR 不使用**）。API 作成（Identifier=`https://wine-record-rohta.vercel.app/mcp`）/ **Default Audience** 設定 / **Application（Regular Web App）作成**（Callback=`https://claude.ai/api/mcp/auth_callback`）。issuer・audience・client_id・client_secret を控える。※ DCR は無料プランで不可のため手動クライアントを使う。
- [ ] T018 [US2] **環境変数**を設定する（quickstart.md ステップ2）。Vercel に `AUTH0_ISSUER_BASE_URL`・`AUTH0_AUDIENCE` を登録、ローカル `.env` にも設定（client_id/secret はサーバー env でなく claude.ai 側に入力）。リポジトリに literal を置かない。
- [ ] T019 [US2] `iac/main.tf` の `vercel_authentication.deployment_type` を `none` に更新し、README の該当記述も「アプリ層 OAuth へ移行」に修正。`cd iac && terraform plan && terraform apply`（エッジ SSO 解除）。
- [ ] T020 [US2] 本番 curl で確認する（quickstart.md ステップ4）。未認証 POST /mcp→401＋WWW-Authenticate、`/.well-known/oauth-protected-resource`→200 JSON。
- [ ] T021 [US2] **claude.ai 実機検証**（quickstart.md ステップ5・手動）。コネクタ URL 登録→**Advanced settings に client_id/secret 入力**→OAuth 同意→接続済み→ラベル写真→preview_record→承認→record_wine→wineId 取得→Upstash で 1 件増を裏取り。

**チェックポイント**: US1（接続）と US2（認証済み記録）が成立。ホスト稼働の価値を実証。

---

## Phase 5: ユーザーストーリー 3 - 未認証アクセスの拒否（優先度: P2）

**ゴール**: 無効・期限切れ・audience 不一致のトークンを確実に 401 で拒否し、秘匿情報を漏らさない。

**独立したテスト**: 3 種の不正トークンで 401／処理未実行／応答・ログに秘匿情報なし、を結合テストで検証。

### US3 テスト

- [X] T022 [US3] `tests/integration/authGate.test.ts` に拒否系を追加する（フェイク検証器が「無効/期限切れ/aud 不一致」を返す各ケース→401、ツールハンドラが呼ばれない、応答ボディは種別のみ）。contracts/auth-http-contract.md C3。
- [X] T023 [US3] 秘匿情報非漏洩の回帰テストを追加する（401 応答・ログにトークン値/鍵/スタックが含まれないことを assert）。

### US3 実装

- [X] T024 [US3] T022/T023 を Green にするよう `src/server.ts` の 401 経路を仕上げる（エラー応答は `{error:"unauthorized"}` 等の種別のみ、verifier 失敗理由を内部ログにも秘匿情報なしで記録）。US1 のゲートで大半は満たされる想定で、差分のみ対応。

**チェックポイント**: 全ユーザーストーリーが独立して機能。

---

## Phase 6: 仕上げと横断的な関心事

**目的**: ドキュメント整備と最終検証。

- [ ] T025 [P] `README.md` を更新する（認証付き接続・Auth0 セットアップへのリンク・必要 env）。
- [ ] T026 [P] `docs/` または research.md/plan.md にデプロイ/認証方針の最終形を追記する（Phase 3 #25 引き継ぎ事項を解消）。
- [ ] T027 quickstart.md の検証を実行し（自動ゲート＋実機）、`specs/002-mcp-oauth-auth/checklists/` に結果を残す。
- [ ] T028 全ゲート（typecheck/lint/format:check/test/build）最終確認と、既存 52＋新規テストが緑であることの確認。

---

## 依存関係と実行順序

### フェーズの依存関係

- **Setup (P1)**: 依存なし。
- **基盤 (P2)**: Setup 後。全ストーリーをブロック（T004→T005、T006→T007）。
- **US1 (P3)**: 基盤後。MVP。T008/T009/T010（テスト）→ T011/T012/T013/T014（実装）→ T015。
- **US2 (P4)**: 基盤後・US1 のゲート実装（T014）に依存（実機・インフラ）。T016→T017→T018→T019→T020→T021。
- **US3 (P5)**: 基盤後・US1 のゲート（T014）に依存。T022/T023→T024。
- **仕上げ (P6)**: 望むストーリー完了後。

### ユーザーストーリーの独立性

- **US1**: 自動テスト（フェイク検証器）で単独検証可能＝MVP。
- **US2**: US1 のゲート＋実 Auth0/Vercel が前提（実機の価値実証）。
- **US3**: US1 のゲート上で拒否系を網羅（自動テストで単独検証可能）。

### 並列化の機会

- T003（.env.example）は T002 と別ファイルで [P]。
- US1 のテスト T008/T009 は別ファイルで [P]。実装 T011/T012 も別ファイルで [P]（T013/T014 は server.ts/tokenVerifier に集約のため逐次）。
- US1 完了後、US2（インフラ・実機）と US3（拒否テスト）は別領域のため並行可能。

---

## 実装戦略

### まず MVP（US1 のみ）

1. Phase 1（Setup）→ Phase 2（基盤・認証シーム、既存 52 緑維持）。
2. Phase 3（US1）: テスト先行 → ゲート実装 → 全ゲート緑。
3. **停止して検証**: 自動テストで「未認証 401 / メタデータ / 有効トークン通過」を確認。

### インクリメンタルな納品

1. Setup + 基盤 → 認証シーム準備完了。
2. US1 → 自動ゲート成立（MVP）。
3. US2 → Auth0/Vercel 実設定 → claude.ai 実機で record_wine 往復（ホスト稼働の価値）。
4. US3 → 拒否系の網羅で安全境界を確定。
5. 仕上げ → ドキュメント・最終検証。

---

## メモ

- [P] = 異なるファイル・依存なし。[Story] はトレーサビリティ用。
- 憲章 II: テストを先に書き、落ちることを確認してから実装する。
- 秘匿情報（Auth0 ドメイン/audience/トークン）は env 管理。リポジトリ・ログ・エラーに literal/値を出さない。
- T017/T018/T021 は手動操作（Auth0 ダッシュボード・Vercel env・claude.ai）。実行後に結果を tasks に追記。
- 各タスク／論理単位ごとにコミットする。
