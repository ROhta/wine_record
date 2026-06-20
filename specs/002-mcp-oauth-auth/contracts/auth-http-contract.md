# 契約: 認証 HTTP 挙動（/mcp・/health・well-known）

リソースサーバーが満たす HTTP 契約。MCP 認証仕様（2025-06-18）と RFC 9728/6750 に準拠。
すべて結合テスト（`tests/integration/authGate.test.ts`）で検証する。

## C1. 未認証で `/mcp` → 401 + WWW-Authenticate

```
POST /mcp        （Authorization ヘッダ無し）
↓
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://<host>/.well-known/oauth-protected-resource"
Content-Type: application/json

{ "error": "unauthorized" }
```

- ボディに秘匿情報を含めない（種別のみ）。
- `resource_metadata` の URL は自サーバーの well-known を指す。

## C2. 有効トークンで `/mcp` → 通過（従来どおり）

```
POST /mcp
Authorization: Bearer <valid Auth0 JWT (aud=正規MCP URL)>
↓
HTTP/1.1 200 OK   （MCP の通常応答。initialize/tools/list/tools/call が機能）
```

## C3. 無効・期限切れ・audience 不一致 → 401

| ケース | 期待 |
| --- | --- |
| 署名不正・改ざん | 401（処理は実行されない） |
| 期限切れ（exp 過去） | 401 |
| `aud` が別サービス向け | 401（自分宛でないため拒否。MUST） |
| `iss` 不一致 | 401 |

いずれも応答・ログにトークン値・鍵・スタック等の秘匿情報を出さない。

## C4. `GET /.well-known/oauth-protected-resource` → 200（RFC 9728）

```
GET /.well-known/oauth-protected-resource
↓
HTTP/1.1 200 OK
Content-Type: application/json
（[protected-resource-metadata.md](./protected-resource-metadata.md) の JSON）
```

- パス付き fallback `GET /.well-known/oauth-protected-resource/mcp` も同等の JSON を返す（claude.ai の probe 対策）。
- 認証不要（公開メタデータ）。

## C5. `GET /health` → 200（認証不要・liveness 維持）

```
GET /health
↓
HTTP/1.1 200 OK
{ "status": "ok" }
```

- 認証ゲートの**外**に置く（既存の挙動を維持）。Helmet 既定ヘッダは継続。

## C6. 認証 OFF（ローカル/テスト）時の挙動

- `AuthConfig` 未設定（issuer/audience 両方なし）の場合、`/mcp` は認証を要求せず通過する（開発・既存テスト互換）。
- 本番（Vercel）では必ず設定し、未認証 401 を有効化する。設定の片方のみはエラー。
