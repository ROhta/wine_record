import type {z} from "zod"

/**
 * Zod のエラーから、不正だったフィールドのパスのみを重複排除・ソートして返す。
 * `issue.message` やパース対象の値（トークン・URL 等の秘匿情報）は決して含めない
 * （エラー応答・ログに値を漏らさないための非漏洩規約を 1 箇所に閉じ込める）。
 * メッセージの接頭辞（「環境変数が…」等）は呼び出し側ごとの別の決定なので、ここでは付けない。
 */
export function zodFieldNames(error: z.ZodError): string[] {
	return [...new Set(error.issues.map(i => i.path.map(String).join(".")))].sort()
}
