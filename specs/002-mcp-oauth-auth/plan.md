# 実装計画: MCP コネクタの OAuth 認証（claude.ai 接続）

**ブランチ**: `002-mcp-oauth-auth` | **日付**: 2026-06-20 | **仕様**: [spec.md](./spec.md)

**入力**: `/specs/002-mcp-oauth-auth/spec.md` の機能仕様

## 概要

claude.ai のリモート MCP コネクタが wine-record に「認証付き」で接続できるようにする。
自サーバー（Express + Streamable HTTP, `/mcp`）を **OAuth 2.1 リソースサーバー**化し、
Bearer アクセストークンの検証ゲートを `/mcp` の前段に置く。トークン発行は **Auth0**（認可サーバー）に委譲し、
claude.ai は Auth0 の **Dynamic Client Registration (DCR, RFC 7591)** で自動登録する。

技術的アプローチ:
- トークン検証は Auth0 の `express-oauth2-jwt-bearer`（`auth()`）で RS256 JWT を JWKS 検証（issuer + audience 必須）。
- MCP 仕様（2025-06-18）準拠のため、自前で **RFC 9728 Protected Resource Metadata** (`/.well-known/oauth-protected-resource`) を配信し、未認証時に **401 + `WWW-Authenticate: Bearer resource_metadata="..."`** を返す。
- 保護の責務を Vercel エッジ層（SSO）から **アプリ層 OAuth + Auth0** に移す。`iac/` の `vercel_authentication` を `none` に更新。
- 既存の `createApp(deps)` / `createMcpServer(deps)` の合成パターンと「遅延依存・env 非依存テスト」を踏襲し、認証も注入可能な形にして TDD する。

## 技術コンテキスト

**言語/バージョン**: TypeScript（`@tsconfig/strictest`）/ Node.js 24・ESM

**主要な依存**: 既存（`@modelcontextprotocol/sdk`, `express` 5, `helmet`, `zod`, `@upstash/vector`）＋ 追加 `express-oauth2-jwt-bearer`（Auth0・RS256 JWT 検証）。RFC 9728 メタデータ／WWW-Authenticate は自前の薄い実装（追加依存なし）。

**ストレージ**: 既存の Upstash Vector（変更なし）。認証では永続ストアを追加しない（トークンはステートレス検証）。

**テスト**: Vitest。認証ミドルウェア・メタデータ生成・トークン検証の単体／結合テストを先行作成（TDD）。検証は env 非依存で行えるよう、トークン検証関数を注入可能にする。

**対象プラットフォーム**: Vercel（サーバーレス・Fluid Compute, iad1）。クライアントは claude.ai（Web/モバイル）ホスト版コネクタ。

**プロジェクト種別**: web-service（リモート MCP サーバー・単一プロジェクト）。

**性能目標**: 既存どおり（ツール呼び出しは対話レイテンシで十分）。JWKS は SDK が取得・キャッシュ（毎リクエストの鍵取得を避ける）。

**制約**: 秘匿情報非漏洩（憲章）。Auth0 ドメイン/audience は `.env`/環境変数（リポジトリに literal を置かない）。既存 52 テスト＋全ゲート（typecheck/lint/format/test/build）を緑のまま維持。authless 公開はしない（未認証は確実に 401）。

**規模/範囲**: 単一ユーザー/単一テナント（認証ゲート成立が目的）。マルチテナントのデータ分離はスコープ外。

## 憲章チェック

*GATE: Phase 0 の調査前に通過しなければならない。Phase 1 の設計後に再チェックする。*

- **原則 I（MCP 契約の明確さ）**: ✅ ツールの入出力契約は不変。認証はトランスポート層に追加され、契約（ツールスキーマ）を壊さない。MCP 認証仕様の標準（401/WWW-Authenticate/Protected Resource Metadata）に準拠＝クライアントから見た認証契約も標準。
- **原則 II（TDD・交渉の余地なし）**: ✅ トークン検証・メタデータ生成・401 応答（WWW-Authenticate 付与）・認証ミドルウェアは、すべて先行テスト（Red→Green）。検証関数を注入可能にし、有効/無効/期限切れ/audience 不一致を env 非依存でテスト。
- **原則 III（厳格な型安全）**: ✅ `any` 不使用。トークンの検証結果・メタデータ・設定は境界で型検証。`express-oauth2-jwt-bearer` の `req.auth` を内部型へ変換。
- **原則 IV（意味的近さ/構造的近さの分離）**: N/A（検索ロジックに変更なし）。
- **原則 V（縦切り・YAGNI）**: ✅ 「未認証拒否 → メタデータ公開 → 認証付きツール実行」の薄い縦切り。独自認可サーバーやマルチテナントは作らない（IdP 委譲・スコープ外明記）。
- **セキュリティと機密情報**: ✅ Auth0 シークレットは環境変数。エラーはフィールド/種別のみ（トークン値・鍵・内部構成を出さない）。Helmet 既定維持。外部入力（トークン）は信頼境界外として検証。
- **開発ワークフロー**: ✅ ブランチ `002-mcp-oauth-auth`、論理単位コミット、speckit 正規フロー、複雑性は下表で管理。

**結論**: ゲート通過。違反なし（複雑さの追跡は「空」）。

## プロジェクト構成

### ドキュメント (この機能)

```text
specs/002-mcp-oauth-auth/
├── plan.md              # このファイル
├── research.md          # Phase 0 の出力（Auth0/MCP 認証の意思決定）
├── data-model.md        # Phase 1 の出力（トークン・メタデータ・設定エンティティ）
├── quickstart.md        # Phase 1 の出力（Auth0 設定＋実機検証手順）
├── contracts/           # Phase 1 の出力（認証 HTTP 契約・メタデータ JSON 形）
│   ├── protected-resource-metadata.md
│   └── auth-http-contract.md
└── tasks.md             # Phase 2 の出力（/speckit-tasks。本コマンドでは作らない）
```

### ソースコード (リポジトリルート)

```text
src/
├── config.ts                  # 既存。Auth0 設定（issuerBaseUrl/audience）を EnvSchema に追加（任意・未設定時は認証無効で起動可＝ローカル/テスト用）
├── server.ts                  # 既存。createApp に認証ミドルウェアと well-known ルートを組み込む（依存注入で検証関数を差し替え可能に）
└── auth/                       # 新規
    ├── tokenVerifier.ts        # Bearer トークン検証の抽象（実体は express-oauth2-jwt-bearer の auth()）。注入可能なインターフェース
    ├── protectedResourceMetadata.ts  # RFC 9728 メタデータ JSON を生成（authorization_servers=Auth0, resource=正規URL）
    └── wwwAuthenticate.ts      # 401 応答に WWW-Authenticate: Bearer resource_metadata=... を付与するヘルパ

tests/
├── unit/
│   ├── protectedResourceMetadata.test.ts   # メタデータ JSON 形（RFC 9728 準拠・authorization_servers/resource）
│   └── wwwAuthenticate.test.ts             # 401 ヘッダ書式
└── integration/
    └── authGate.test.ts        # /mcp と /health の認証挙動（トークン無し=401+WWW-Authenticate / 有効=通過 / 無効・期限切れ・audience 不一致=401 / well-known=200）

iac/
└── main.tf                     # vercel_authentication を none に更新（Deployment Protection 解除）
```

**構造の決定**: 既存の単一プロジェクト構成を維持し、認証関連を `src/auth/` に集約。`server.ts` の既存合成（`createApp(deps)`/`buildExpressApp(resolveDeps)`）に、認証ミドルウェアと well-known ルートを差し込む。検証関数はインターフェース化して注入し、テストは env 非依存（実 Auth0 不要）で実施。`/health` は認証不要のまま（liveness）、`/mcp` のみ保護。

## 複雑さの追跡

> 憲章チェックに違反なし。記入不要（空）。
