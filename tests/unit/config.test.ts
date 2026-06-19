import {describe, it, expect} from "vitest"
import {loadConfig} from "../../src/config.js"

const validEnv: Record<string, string> = {
	UPSTASH_VECTOR_REST_URL: "https://example.upstash.io",
	UPSTASH_VECTOR_REST_TOKEN: "tok_secret_value",
	R2_ACCOUNT_ID: "acct",
	R2_ACCESS_KEY_ID: "akid",
	R2_SECRET_ACCESS_KEY: "r2_secret_value",
	R2_BUCKET: "bucket",
	R2_PUBLIC_BASE_URL: "https://img.example.com",
	PORT: "4000",
}

describe("loadConfig", () => {
	it("完全な環境変数を型付き config に変換する（PORT は数値）", () => {
		const cfg = loadConfig(validEnv)
		expect(cfg.upstash.url).toBe("https://example.upstash.io")
		expect(cfg.upstash.token).toBe("tok_secret_value")
		expect(cfg.r2.bucket).toBe("bucket")
		expect(cfg.port).toBe(4000)
	})

	it("PORT 未指定なら 3000 を既定にする", () => {
		const {PORT: _PORT, ...rest} = validEnv
		expect(loadConfig(rest).port).toBe(3000)
	})

	it("画像ストレージ変数を省略しても Upstash + PORT だけで load できる（画像=US3 は未着手・任意）", () => {
		const cfg = loadConfig({
			UPSTASH_VECTOR_REST_URL: "https://example.upstash.io",
			UPSTASH_VECTOR_REST_TOKEN: "tok",
		})
		expect(cfg.upstash.url).toBe("https://example.upstash.io")
		expect(cfg.port).toBe(3000)
		// 未設定時は publicBaseUrl='' = どの imageUrl も受理しない（fail-closed）。
		expect(cfg.r2.publicBaseUrl).toBe("")
		expect(cfg.r2.bucket).toBeNull()
	})

	it("必須キー欠落で throw し、メッセージに欠落フィールド名を含む", () => {
		const {UPSTASH_VECTOR_REST_TOKEN: _t, ...rest} = validEnv
		expect(() => loadConfig(rest)).toThrowError(/UPSTASH_VECTOR_REST_TOKEN/)
	})

	it("不正値で throw するが、メッセージに値（秘匿情報）を漏らさない", () => {
		const bad = {...validEnv, PORT: "not-a-number"}
		try {
			loadConfig(bad)
			throw new Error("should have thrown")
		} catch (e) {
			const msg = (e as Error).message
			expect(msg).toContain("PORT")
			expect(msg).not.toContain("not-a-number")
			expect(msg).not.toContain("tok_secret_value")
		}
	})
})
