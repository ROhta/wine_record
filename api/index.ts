import type {Express} from "express"
import {createConfiguredApp} from "../src/server.js"

/**
 * Vercel サーバーレスエントリポイント。
 * Vercel の Express サポートに従い、構築済みの Express アプリを default export する
 * （https://vercel.com/docs/frameworks/backend/express）。vercel.json で全パスをこの関数へ
 * rewrite し、Express 側で /mcp・/health をルーティングする。ローカル起動は src/server.ts の start()。
 */
const app: Express = createConfiguredApp()

export default app
