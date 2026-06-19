/**
 * [SPIKE] T012: 画像アップロード経路（Vercel Blob / private ストア）の検証（捨てコード）
 *
 * 殺したい未知数:
 *   private Vercel Blob で「アップロード → 公開URL不可 → 認証付き取得（get）」が成立するか。
 *   これが get_upload_url(T035) / imageStore(T034) の前提。
 *   ※ R2 は無料枠でもカード必須、Vercel Blob は private を選択（ラベル画像を公開URLに晒さない）。
 *
 * private の配信モデル（重要・設計に影響）:
 *   private blob は公開 URL で取得できない。読み取りは SDK の get(pathname,{access:'private'}) か
 *   `Authorization: Bearer <BLOB_READ_WRITE_TOKEN>` 付き fetch のみ。実アプリでは「自サーバーの
 *   認証付きルートが get() でストリーム配信」する形になる（imageUrl は公開URLではなく自サーバー経由）。
 *
 * 注意（widget ギャップ）:
 *   「チャット添付画像 → ストレージ」の UX は widget 必須で現状不可（research.md R5）。
 *   本スパイクは **ストレージ機構（put/private 取得）のみ**を検証する。
 *
 * 実行: node --env-file=.env --import tsx spikes/image-upload/run.ts
 */
import { put, get, del } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error(
    '✗ 環境変数 BLOB_READ_WRITE_TOKEN が未設定です。\n' +
      '  Vercel に private Blob ストアを作成し、Read-Write トークンを .env に設定してください。',
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

  // 1) アップロード（private）
  try {
    const blob = await put(pathname, pngBytes, {
      access: 'private',
      token,
      contentType: 'image/png',
      addRandomSuffix: false,
    });
    blobUrl = blob.url;
    checks.push({ label: 'put(access:private): アップロード', ok: true, detail: blob.url });
  } catch (e) {
    checks.push({ label: 'put', ok: false, detail: errMsg(e) });
    return report(checks, blobUrl);
  }

  // 2) 公開アクセス不可の確認（認証なし fetch は 401/403 のはず）
  try {
    const res = await fetch(blobUrl);
    const ok = !res.ok; // private なので失敗するのが正しい
    checks.push({
      label: '認証なし fetch は拒否される（private 確認）',
      ok,
      detail: `HTTP ${res.status}（401/403 が期待値）`,
    });
  } catch (e) {
    // ネットワーク拒否系も「公開取得できない」= OK 扱い
    checks.push({ label: '認証なし fetch は拒否される（private 確認）', ok: true, detail: `fetch 失敗: ${errMsg(e)}` });
  }

  // 3) 認証付き取得: get(pathname,{access:'private'}) でストリーム取得しバイト一致
  try {
    const result = await get(pathname, { access: 'private', token });
    if (!result || result.statusCode !== 200 || !result.stream) {
      checks.push({ label: 'get(access:private): 認証付き取得', ok: false, detail: `statusCode=${result?.statusCode}` });
    } else {
      const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
      const sameBytes = buf.equals(pngBytes); // サイズではなく実バイト列で完全一致を検証
      checks.push({
        label: 'get(access:private): 認証付き取得',
        ok: sameBytes,
        detail: `statusCode=200 / バイト列一致? ${sameBytes} (${buf.length}B) / type ${result.blob?.contentType}`,
      });
    }
  } catch (e) {
    checks.push({ label: 'get(access:private)', ok: false, detail: errMsg(e) });
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
  console.log('\n=== T012 Vercel Blob(private) 画像アップロード機構スパイク 結果 ===');
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}\n    ${c.detail}`);
  await cleanup(blobUrl);
  console.log('\n(投入したテスト Blob は削除しました)');
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  console.log(
    allOk
      ? '\n結論: PASS — private Blob の put → 公開不可 → 認証付き get が成立（ストレージ機構は ready）。\n注意: imageUrl は公開URLではなく自サーバーの認証付きルート経由で配信する設計になる（R3）。UX は widget 待ちで保留（R5）。'
      : '\n結論: FAIL — 上記 ✗ を確認。',
  );
  process.exit(allOk ? 0 : 1);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

void main();
