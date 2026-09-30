import {describe, it, expect} from "vitest"
import type {AddressInfo} from "node:net"
import type {Server} from "node:http"
import {createApp, type KeepaliveGate} from "../../src/server.js"
import {makeServerDeps} from "../fixtures/deps.js"

const SECRET = "cron-secret-0123456789"

function startApp(keepalive?: KeepaliveGate): {server: Server; base: string} {
	const {deps} = makeServerDeps()
	const server = createApp(deps, undefined, keepalive).listen(0)
	const {port} = server.address() as AddressInfo
	return {server, base: `http://127.0.0.1:${port}`}
}

function close(server: Server): Promise<void> {
	return new Promise(resolve => server.close(() => resolve()))
}

/** ping の呼び出し回数を数えるゲート。`fail` なら ping が秘匿情報入りの例外を投げる。 */
function countingGate(fail = false): {gate: KeepaliveGate; calls: () => number} {
	let calls = 0
	const gate: KeepaliveGate = {
		secret: SECRET,
		ping: () => {
			calls++
			return fail ? Promise.reject(new Error("upstash token=tok_secret_value")) : Promise.resolve()
		},
	}
	return {gate, calls: () => calls}
}

describe("GET /cron/keepalive（Upstash 休止防止）", () => {
	it("正しい Bearer なら ping を 1 回呼び 200 を返す", async () => {
		const {gate, calls} = countingGate()
		const {server, base} = startApp(gate)
		try {
			const res = await fetch(`${base}/cron/keepalive`, {headers: {Authorization: `Bearer ${SECRET}`}})
			expect(res.status).toBe(200)
			expect(await res.json()).toEqual({status: "ok"})
			expect(calls()).toBe(1)
		} finally {
			await close(server)
		}
	})

	it.each([
		["ヘッダなし", undefined],
		["不一致", "Bearer wrong-secret"],
		["Bearer 接頭辞なし", SECRET],
	])("%s は 401 で ping を呼ばない", async (_label, authorization) => {
		const {gate, calls} = countingGate()
		const {server, base} = startApp(gate)
		try {
			const res = await fetch(`${base}/cron/keepalive`, authorization === undefined ? {} : {headers: {Authorization: authorization}})
			expect(res.status).toBe(401)
			expect(await res.json()).toEqual({error: "unauthorized"})
			expect(calls()).toBe(0)
		} finally {
			await close(server)
		}
	})

	it("keepalive 未設定（CRON_SECRET 無し）なら 404 を返す（fail-closed）", async () => {
		const {server, base} = startApp()
		try {
			const res = await fetch(`${base}/cron/keepalive`, {headers: {Authorization: `Bearer ${SECRET}`}})
			expect(res.status).toBe(404)
		} finally {
			await close(server)
		}
	})

	it("ping 失敗時は 500 を返し、原因（秘匿情報）をレスポンスに出さない", async () => {
		const {gate} = countingGate(true)
		const {server, base} = startApp(gate)
		const originalError = console.error
		console.error = () => undefined
		try {
			const res = await fetch(`${base}/cron/keepalive`, {headers: {Authorization: `Bearer ${SECRET}`}})
			expect(res.status).toBe(500)
			const body = await res.text()
			expect(body).not.toContain("tok_secret_value")
			expect(JSON.parse(body)).toEqual({error: "keepalive_failed"})
		} finally {
			console.error = originalError
			await close(server)
		}
	})
})
