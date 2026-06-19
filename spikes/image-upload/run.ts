/**
 * [SPIKE] T012: 画像アップロード経路（Vercel Blob）の検証（捨てコード）
 *
 * 殺したい未知数:
 *   Vercel Blob で「アップロード → 公開 URL で再取得」が無料枠（Hobby・カード不要の見込み）で
 *   成立するか。これが get_upload_url(T035) / imageStore(T034) の前提。
 *   ※ R2 は無料枠でもカード登録必須のため Vercel Blob に切替（research.md R3）。
 *
 * 注意（widget ギャップ）:
 *   元の T012 は「最小ウィジェットで写真選択 → アップロード」だったが、MCP Apps ウィジェットは
 *   claude.ai リモート HTTP で描画されない（research.md R5 / T022a）。MCP ツール入力も JSON のみで
 *   画像バイトを運べない。よって「チャット添付画像 → ストレージ」の UX は widget なしでは現状成立しない。
 *   本スパイクは **ストレージ機構（アップロード→公開取得）のみ**を検証する。
 *
 * 実行（spikes/image-upload/README.md 参照）:
 *   node --env-file=.env --import tsx spikes/image-upload/run.ts
 */
import { put, del } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error(
    '✗ 環境変数 BLOB_READ_WRITE_TOKEN が未設定です。\n' +
      '  README.md の手順で Vercel に Blob ストアを作成し、Read-Write トークンを .env に設定してください。',
  );
  process.exit(1);
}

const pathname = `spike-t012/test-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
// 1x1 透明 PNG
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function main(): Promise<void> {
  const checks: { label: string; ok: boolean; detail: string }[] = [];
  let blobUrl = '';

  // 1) アップロード（public）。Vercel Blob は put でアップロード＋公開 URL を返す。
  try {
    const blob = await put(pathname, pngBytes, {
      access: 'public',
      token,
      contentType: 'image/png',
      addRandomSuffix: false,
    });
    blobUrl = blob.url;
    checks.push({ label: 'put: アップロード + 公開 URL 発行', ok: true, detail: blob.url });
  } catch (e) {
    checks.push({ label: 'put', ok: false, detail: errMsg(e) });
    return report(checks, blobUrl);
  }

  // 2) 公開 URL で再取得し、バイトが一致するか
  try {
    const res = await fetch(blobUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const sameSize = buf.length === pngBytes.length;
    checks.push({
      label: '公開 URL で再取得',
      ok: res.ok && sameSize,
      detail: `HTTP ${res.status} / bytes ${buf.length}=${pngBytes.length}? ${sameSize} / type ${res.headers.get('content-type')}`,
    });
  } catch (e) {
    checks.push({ label: '公開 URL 取得', ok: false, detail: errMsg(e) });
  }

  await report(checks, blobUrl);
}

async function cleanup(blobUrl: string): Promise<void> {
  if (!blobUrl) return;
  try {
    await del(blobUrl, { token });
  } catch (e) {
    console.warn(`! cleanup 失敗: ${errMsg(e)}`);
  }
}

async function report(checks: { label: string; ok: boolean; detail: string }[], blobUrl: string): Promise<void> {
  console.log('\n=== T012 Vercel Blob 画像アップロード機構スパイク 結果 ===');
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}\n    ${c.detail}`);
  await cleanup(blobUrl);
  console.log('\n(投入したテスト Blob は削除しました)');
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  console.log(
    allOk
      ? '\n結論: PASS — Vercel Blob でアップロード→公開取得が成立（ストレージ機構は ready）。\n注意: チャット添付画像→Blob の UX は widget が必要で現状未解決（research.md R5）。'
      : '\n結論: FAIL — 上記 ✗ を確認。',
  );
  process.exit(allOk ? 0 : 1);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

void main();
