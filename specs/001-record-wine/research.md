# フェーズ0 調査: ワインの記録

技術的な未確定事項の決定と根拠。詳細な背景は
[設計ドキュメント](../../docs/superpowers/specs/2026-06-17-wine-record-design.md) を参照。

## R1. 埋め込みモデル

- **経緯（2026-06-19）**: 設計時の第一候補は多言語対応の hosted `BAAI/bge-m3`。一時は Upstash
  コンソールのインデックス作成画面に当該モデルが出ず（全リージョンで `Custom` と
  `openai/text-embedding-3-small` の二択）、回避策として openai モデルで T014 を検証し PASS した。
  その後、**Vercel の Upstash Vector 統合（Install Integration）からは `BGE_M3` を hosted dense
  モデルとして選択可能**と判明したため、当初設計どおり bge-m3 に戻した。
- **決定**: hosted **`BAAI/bge-m3`**（dense・1024 次元・COSINE）を **Free プラン**で使う
  （テキストを `data` で渡しサーバー側で自動ベクトル化）。`vectorStore.ts` は `data` ベースのまま
  **コード変更不要**（次元が 1536→1024 に変わるが data 方式なので透過）。
- **根拠**: (1) bge-m3 は多言語（日本語に強い）でワイン表現の意味検索に適する。(2) **privacy**:
  埋め込みが Upstash 内で完結し、OpenAI を第三者処理者として経路に挟まない（「なるべく private に」
  方針に合致）。(3) **コスト**: OpenAI のトークン課金が発生せず、Free プラン（1 index。本機能は
  1 index + 4 namespace で充足）に収まる。(4) サーバー側埋め込みという設計の核を維持でき変更が最小。
- **T014 スパイク結果（2026-06-19, PASS）**: 4 namespace の data ベース upsert・fetch（metadata
  往復）・query がいずれも成立。日本語クエリ「ブルゴーニュ 赤 チェリーの香り」で該当ワインが最上位。
  - 暫定 openai/text-embedding-3-small: `dimension=1536` / `COSINE`、score≈0.83 > 0.71。
  - 採用 bge-m3（Free）: `dimension=1024` / `COSINE`、score≈0.87 > 0.75 で PASS（openai 版より分離も良好）。
- **残る未確定**: Free プランの日次リクエスト/容量上限は運用で監視（個人規模では実質誤差の見込み）。
- **代替案（不採用）**:
  - openai/text-embedding-3-small: 動作するが OpenAI が経路に入り（privacy）トークン課金も発生する。
    bge-m3 が選べる以上は優先しない。
  - Custom インデックス + クライアント側埋め込み（multilingual-e5 / bge-m3 をローカル実行）:
    完全無料・データを外に出さないが、`vectorStore` を `vector` ベースへ変更＋記録/検索フローに
    埋め込み処理＋依存追加が必要。個人 MVP では工数・運用負荷が見合わないと判断。
  - タグ集合の Jaccard 重複度: 語間の意味距離（カシス↔ブラックベリー）を捉えられない。
    補助指標としては可だが主軸にしない。

## R2. インデックス構造（意味的 vs 構造的の分離）

- **決定**: 1 インデックス + 複数 namespace。
  `overall`（正本・名前+産地+全表現を結合）、`aroma` / `appearance` / `taste`
  （各表現テキストのみ）。観点別 namespace は metadata に `wineId` のみ持ち、
  検索時に `overall` から `fetch(ids)` でハイドレートする。
  産地・ヴィンテージは metadata（階層・数値）で保持し、ベクトルにしない。
- **根拠**: 香り等の意味的近さは観点別ベクトルで、産地・年の構造的近さは
  メタデータで扱う（憲章 IV）。記録フローでは全 namespace へ書き込み、検索フロー
  （次スコープ）が読む。単一の真実源を `overall` に置く。
- **代替案**: 単一 namespace に結合テキストのみ → 観点別の意味検索ができない。
  観点ごとに別インデックス → 無料枠のインデックス数を圧迫し、共通メタデータが分散。

## R3. ラベル画像の永続化

- **決定（2026-06-19 更新）**: オブジェクトストレージに保存し、Vector には URL のみ持つ。
  当初既定の **Cloudflare R2** は無料枠でも**カード登録必須**と判明したため、代替候補だった
  **Vercel Blob（private ストア）**（Hobby・1GB/月・非商用・カード不要を確認）に切替。
  `@vercel/blob` の `put(access:'private')` で保存。**private blob は公開 URL で取得できない**ため、
  `imageUrl` は公開 URL ではなく**自サーバーの認証付きルートが `get(access:'private')` でストリーム配信**する
  形になる（ラベル画像を公開に晒さない）。T034/T035/T036 はこの前提で設計する。
- **根拠**: ベクトル DB のメタデータは画像バイナリ用ではない。直接アップロードで
  サーバーを画像バイトの中継にしない（負荷・メモリ・セキュリティ面で有利）。
- **代替案**: 画像を base64 でメタデータに格納 → サイズ・コスト・上限で破綻。
  サーバー中継アップロード → サーバーが大きなバイナリを扱う必要があり不利。
- **T012 スパイク結果（2026-06-19, PASS）**: private Vercel Blob で put → 認証なし fetch は 403（公開不可）
  → `get(access:'private')` で 200・バイト一致を確認。ストレージ機構は ready。
- **保留**: 「チャット添付画像→ストレージ」の UX は widget 必須で現状不可（R5）。よって US3 の実機実装は
  widget 対応待ち。Upstash はオブジェクト保存不可。card-free の控え: Supabase Storage / Cloudinary。

## R4. OCR（文字読み取り）

- **決定**: 接続先のマルチモーダル LLM（Claude / Codex）の vision に委ねる。
  専用 OCR サービス（Tesseract / クラウド OCR）は置かない。
- **根拠**: クライアントが既に画像読解可能な LLM。読み取り→確認→保存の流れに
  自然に組み込め、構成が簡素化する。
- **T013 スパイク結果（2026-06-19, PASS）**: Claude モバイルにリモート MCP サーバーを
  カスタムコネクタ登録し、ラベル写真→vision 抽出→`record_wine`→Upstash 永続化を確認。
  例: 日本ワインを `name`/`producer`/`country=日本`/`region=山梨`/`vintage=2023`/`color=red`
  として構造化保存できた。なお「`record_wine` ツールを使って」と明示しないとモデルがツールを
  呼ばず自然言語で答えるだけのことがある（確認ウィジェット T022 で明示承認フローにする裏付け）。
- **代替案**: サーバー側 OCR → 追加サービス・コスト・別の精度問題。
  サーバー側で LLM vision を再実行（Claude API）→ フォールバックとしては可だが初期は不要。

## R5. 確認 UI（テキスト確認フローへ方針転換）

- **当初の決定**: 確認・タップ選択 UI を MCP Apps ウィジェット（UI リソース）として描画する想定だった。
- **T022a スパイク結果（2026-06-19）**: リモート Streamable-HTTP（claude.ai のカスタムコネクタ＝
  モバイルが使える唯一の接続形態）では **MCP Apps ウィジェットが描画されない**（"No approval received"・
  iframe 非表示）。既知の未解決問題（anthropics/claude-ai-mcp#61, modelcontextprotocol/ext-apps#671/#481）で、
  widget は **stdio/デスクトップでは動く**がリモート HTTP では現状不可。bingo_mcp が動いていたのは
  stdio/デスクトップだったため（差分はトランスポートのみ）。elicitation も claude.ai 未対応
  （claude-ai-mcp#153・機能要望段階）。サーバー実装自体は canonical に正しいことを確認済み。
- **決定（転換後）**: US1 の確認は **テキスト確認フロー**で実現する。読み取り専用ツール
  `preview_record` が下書きを正規化・検証して「保存される内容」をテキスト＋structuredContent で返し、
  ユーザーが確認・修正する。`record_wine` の description で「ユーザーが明示承認した後にのみ呼ぶ」を
  規定する。ただし claude.ai リモート HTTP では UI ゲートが使えないため、これは**ハードな強制ではなく
  会話プロトコルによるベストエフォート**である（モデルは技術的には preview をスキップして record_wine を
  直接呼べる）。完全な明示承認ゲートは widget/elicitation が使えるようになるまで実現不可。
  必要なら部分的強化として「preview_record が正規化内容の HMAC トークンを返し、record_wine が
  同一内容のトークンを要求する」案がある（内容一致は強制できるが、ユーザーが見たことの証明にはならない）。
- **保留**: US2 の「タップ選択（自由入力なし）」も同じ理由でリモート HTTP では現状実現困難。
  画像アップロード（US3）も含め、claude.ai が widget/elicitation をリモート HTTP で安定対応したら再導入する。

## R6. シークレットと HTTP セキュリティ

- **決定**: Upstash / ストレージのトークンは環境変数。HTTP 層は Helmet 系の
  セキュアヘッダを既定適用。署名 URL は短命・単一用途。
- **根拠**: 憲章「セキュリティと機密情報」に準拠。secure-by-default のライブラリを優先。
