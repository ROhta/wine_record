# Claude から使う（リモートコネクタ・OAuth 認証付き）

本番は **Vercel にホスト**（`https://wine-record-rohta.vercel.app/mcp`）し、**Auth0 による OAuth 認証**付きで claude.ai の「カスタムコネクタ」から接続する（US 002）。`/mcp` は Bearer トークン検証で保護され、未認証は `401 + WWW-Authenticate` を返す（公開だが authless ではない）。

- 認証を有効化するサーバー側 env: `AUTH0_ISSUER_BASE_URL` / `AUTH0_AUDIENCE`（両方設定で ON、両方未設定で OFF）。
- claude.ai のコネクタ追加 → **Advanced settings** に Auth0 アプリの client_id/secret を入力 → ログイン/同意 → 接続。
- Auth0 側のセットアップ手順・ハマりどころは [`specs/002-mcp-oauth-auth/quickstart.md`](../../specs/002-mcp-oauth-auth/quickstart.md)。

ローカル開発では `AUTH0_*` 未設定（認証 OFF）で動かし、`:3000` を [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 等で公開して試すこともできる。インフラ（Vercel プロジェクト設定）は [`iac/`](../../iac/) で Terraform 管理。
