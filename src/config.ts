import { z } from 'zod';

/**
 * 環境変数スキーマ（キーは実際の環境変数名）。
 * 値の検証に失敗しても、エラーには「フィールド名」のみを出し、値（トークン等の秘匿情報）は出さない。
 */
const EnvSchema = z.object({
  UPSTASH_VECTOR_REST_URL: z.string().min(1),
  UPSTASH_VECTOR_REST_TOKEN: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

/** アプリの型付き設定。 */
export interface Config {
  upstash: { url: string; token: string };
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
  };
  /** MCP サーバー（Streamable HTTP）が listen するポート。 */
  port: number;
}

/**
 * 環境変数を検証して型付き設定を返す。必須キー欠落・不正値があれば、
 * フィールド名のみを列挙して throw する（値はログ・例外に出さない）。
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((i) => i.path.map(String).join('.'))),
    ].sort();
    throw new Error(`環境変数が不正または欠落しています: ${fields.join(', ')}`);
  }
  const e = result.data;
  return {
    upstash: { url: e.UPSTASH_VECTOR_REST_URL, token: e.UPSTASH_VECTOR_REST_TOKEN },
    r2: {
      accountId: e.R2_ACCOUNT_ID,
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
      bucket: e.R2_BUCKET,
      publicBaseUrl: e.R2_PUBLIC_BASE_URL,
    },
    port: e.PORT,
  };
}
