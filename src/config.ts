import {z} from "zod"

/**
 * 環境変数スキーマ（キーは実際の環境変数名）。
 * 値の検証に失敗しても、エラーには「フィールド名」のみを出し、値（トークン等の秘匿情報）は出さない。
 */
const EnvSchema = z
	.object({
		UPSTASH_VECTOR_REST_URL: z.string().min(1),
		UPSTASH_VECTOR_REST_TOKEN: z.string().min(1),
		// 画像ストレージは US3（ラベル画像永続化）用。US3 は widget 対応待ちで未着手のため、
		// US1+US2 の稼働には不要 → 任意。R3 で Vercel Blob を採用予定（現状の R2_* 名は US3 実装時に見直す）。
		R2_ACCOUNT_ID: z.string().optional(),
		R2_ACCESS_KEY_ID: z.string().optional(),
		R2_SECRET_ACCESS_KEY: z.string().optional(),
		R2_BUCKET: z.string().optional(),
		R2_PUBLIC_BASE_URL: z.string().optional(),
		// Auth0（MCP コネクタ OAuth・US 002）。両方設定で認証 ON / 両方未設定で OFF（ローカル/テスト）。
		// 片方のみは設定ミスとして下の superRefine で弾く（欠落フィールド名のみを返す）。
		AUTH0_ISSUER_BASE_URL: z.string().optional(),
		AUTH0_AUDIENCE: z.string().optional(),
		PORT: z.coerce.number().int().positive().default(3000),
	})
	.superRefine((e, ctx) => {
		if (e.AUTH0_ISSUER_BASE_URL && !e.AUTH0_AUDIENCE) {
			ctx.addIssue({code: "custom", path: ["AUTH0_AUDIENCE"], message: "required when AUTH0_ISSUER_BASE_URL is set"})
		}
		if (e.AUTH0_AUDIENCE && !e.AUTH0_ISSUER_BASE_URL) {
			ctx.addIssue({code: "custom", path: ["AUTH0_ISSUER_BASE_URL"], message: "required when AUTH0_AUDIENCE is set"})
		}
	})

/** アプリの型付き設定。 */
export interface Config {
	upstash: {url: string; token: string}
	/**
	 * 画像ストレージ（US3 用・任意）。US3 未着手のため未設定でも起動する。
	 * `publicBaseUrl` は未設定なら `''`（= record_wine がどの imageUrl も受理しない fail-closed）。
	 */
	r2: {
		accountId: string | null
		accessKeyId: string | null
		secretAccessKey: string | null
		bucket: string | null
		publicBaseUrl: string
	}
	/**
	 * MCP コネクタ OAuth 認証（Auth0・US 002）。
	 * `null` なら認証 OFF（ローカル/テスト）。本番は必ず設定する。
	 * `issuerBaseUrl`=Auth0 テナント発行者 URL、`audience`=API Identifier（= 正規 MCP URL）。
	 */
	auth: {issuerBaseUrl: string; audience: string} | null
	/** MCP サーバー（Streamable HTTP）が listen するポート。 */
	port: number
}

/**
 * 環境変数を検証して型付き設定を返す。必須キー欠落・不正値があれば、
 * フィールド名のみを列挙して throw する（値はログ・例外に出さない）。
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	const result = EnvSchema.safeParse(env)
	if (!result.success) {
		const fields = [...new Set(result.error.issues.map(i => i.path.map(String).join(".")))].sort()
		throw new Error(`環境変数が不正または欠落しています: ${fields.join(", ")}`)
	}
	const e = result.data
	return {
		upstash: {url: e.UPSTASH_VECTOR_REST_URL, token: e.UPSTASH_VECTOR_REST_TOKEN},
		r2: {
			accountId: e.R2_ACCOUNT_ID ?? null,
			accessKeyId: e.R2_ACCESS_KEY_ID ?? null,
			secretAccessKey: e.R2_SECRET_ACCESS_KEY ?? null,
			bucket: e.R2_BUCKET ?? null,
			publicBaseUrl: e.R2_PUBLIC_BASE_URL ?? "",
		},
		auth: e.AUTH0_ISSUER_BASE_URL && e.AUTH0_AUDIENCE ? {issuerBaseUrl: e.AUTH0_ISSUER_BASE_URL, audience: e.AUTH0_AUDIENCE} : null,
		port: e.PORT,
	}
}
