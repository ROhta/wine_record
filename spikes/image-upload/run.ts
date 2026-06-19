/**
 * [SPIKE] T012: 画像アップロード経路（R2 署名付き PUT）の検証（捨てコード）
 *
 * 殺したい未知数:
 *   Cloudflare R2 で「署名付き PUT URL を発行 → 直接アップロード → 公開 URL で再取得」が
 *   無料枠で成立するか。これが get_upload_url(T035) / imageStore(T034) の前提。
 *
 * 注意（widget ギャップ）:
 *   元の T012 は「最小ウィジェットで写真選択 → PUT」だったが、MCP Apps ウィジェットは
 *   claude.ai リモート HTTP で描画されない（research.md R5 / T022a）。MCP ツール入力も
 *   JSON のみで画像バイトを運べない。よって「チャット添付画像 → R2」の UX は widget なしでは
 *   現状成立しない。本スパイクは **ストレージ機構（署名付き PUT 往復）のみ**を検証する。
 *
 * 実行（spikes/image-upload/README.md 参照）:
 *   node --env-file=.env --import tsx spikes/image-upload/run.ts
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
  console.error(
    '✗ 環境変数が未設定です: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL\n' +
      '  README.md の手順で R2 バケットと API トークンを用意し、.env に設定してください。',
  );
  process.exit(1);
}

const CONTENT_TYPE = 'image/png';
const key = `spike-t012/test-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
// 1x1 透明 PNG
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function main(): Promise<void> {
  const checks: { label: string; ok: boolean; detail: string }[] = [];

  // 1) 署名付き PUT URL を発行（短命 300 秒）
  let uploadUrl = '';
  try {
    uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: CONTENT_TYPE }),
      { expiresIn: 300 },
    );
    checks.push({ label: 'getSignedUrl: 署名付き PUT URL 発行', ok: true, detail: `${uploadUrl.slice(0, 60)}...` });
  } catch (e) {
    checks.push({ label: 'getSignedUrl', ok: false, detail: errMsg(e) });
    return report(checks);
  }

  // 2) 署名付き URL へ直接 PUT（クライアントが行う想定の動作）
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': CONTENT_TYPE },
      body: pngBytes,
    });
    const ok = res.ok;
    checks.push({ label: '署名付き URL へ直接 PUT アップロード', ok, detail: `HTTP ${res.status}` });
    if (!ok) {
      return report(checks);
    }
  } catch (e) {
    checks.push({ label: 'PUT upload', ok: false, detail: errMsg(e) });
    return report(checks);
  }

  // 3) 公開 URL で再取得（imageUrl として保存する URL。公開アクセス必須）
  const publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
  try {
    const res = await fetch(publicUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const sameSize = buf.length === pngBytes.length;
    const ok = res.ok && sameSize;
    checks.push({
      label: `公開 URL で再取得 (${publicUrl})`,
      ok,
      detail: `HTTP ${res.status} / bytes ${buf.length}=${pngBytes.length}? ${sameSize}`,
    });
    if (!res.ok) {
      console.error(
        '  ↑ 公開取得に失敗。R2 バケットの公開アクセス（r2.dev もしくはカスタムドメイン）が\n' +
          '    有効か、R2_PUBLIC_BASE_URL がそのドメインを指しているか確認してください。',
      );
    }
  } catch (e) {
    checks.push({ label: '公開 URL 取得', ok: false, detail: errMsg(e) });
  }

  await report(checks);
}

/** 投入したテストオブジェクトを削除する。 */
async function cleanup(): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (e) {
    console.warn(`! cleanup 失敗: ${errMsg(e)}`);
  }
}

async function report(checks: { label: string; ok: boolean; detail: string }[]): Promise<void> {
  console.log('\n=== T012 R2 画像アップロード機構スパイク 結果 ===');
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}\n    ${c.detail}`);
  await cleanup();
  console.log('\n(投入したテストオブジェクトは削除しました)');
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  console.log(
    allOk
      ? '\n結論: PASS — 署名付き PUT → 公開 URL 再取得が成立（ストレージ機構は ready）。\n注意: チャット添付画像→R2 の UX は widget が必要で現状未解決（research.md R5）。'
      : '\n結論: FAIL — 上記 ✗ を確認。',
  );
  // 公開取得が落ちても機構（presign+PUT）が通れば部分的価値はある。終了コードは全 OK のみ 0。
  process.exit(allOk ? 0 : 1);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

void main();
