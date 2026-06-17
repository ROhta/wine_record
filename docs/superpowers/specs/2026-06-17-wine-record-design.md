# ワイン記録アプリ — 設計ドキュメント

- 日付: 2026-06-17
- ステータス: 承認済み（ブレインストーミング成果物）
- 次工程: speckit（`/speckit.constitution` → `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`）

## 1. 目的

飲んだワインを記録・検索するアプリ。Claude / Codex のモバイルアプリから
「リモート MCP サーバー」に接続し、ラベル画像のアップロード・記録・観点別の
類似検索を行う。ユーザーは文字入力をせず、表現はタップ選択する。

## 2. アーキテクチャ（確定事項）

**実体 = リモート MCP Apps サーバー**（bingo_mcp の正統進化形）。

```
[Claude / Codex モバイルアプリ]  ← LLM本体: vision(OCR) / 推論 / 観点別提示の文章化
        │  Streamable HTTP (リモート MCP 接続)
        ▼
[Wine MCP サーバー (TypeScript)]   ← 本プロジェクトで作る部分
        ├─ MCP ツール: get_jsa_taxonomy / record_wine / search_wine / get_upload_url
        ├─ MCP Apps ウィジェット: 確認フォーム / タップ選択UI / 結果カード
        ├─ Upstash Vector (記録の保存・観点別クエリ)
        └─ オブジェクトストレージ (Cloudflare R2 もしくは Vercel Blob: ラベル画像本体)
```

責務分離:
- **LLM 本体（接続先アプリ）**: ラベルの OCR（vision）、推論、観点別提示の文章生成。
- **MCP サーバー（自作）**: JSA タクソノミー提供 / 構造化保存 / 観点別クエリ / タップ UI 描画。
- 専用 OCR サービスは不要（LLM の vision が担う）。

技術スタック: TypeScript（bingo_mcp と同系、`@tsconfig/strictest`）、
`@upstash/vector` JS SDK、MCP TypeScript SDK、Streamable HTTP リモート。

## 3. データモデル（Upstash Vector）

**1 インデックス + 複数 namespace**。埋め込みは組み込みモデル **`BAAI/bge-m3`**
（多言語＝日本語の JSA 表現をそのままベクトル化）。テキストを `data` で渡すと
自動ベクトル化されるため、自前で埋め込み API を叩かない。

| namespace | ベクトル化対象 | metadata |
|---|---|---|
| `overall`（既定・正本）| 名前＋産地＋全表現を結合したテキスト | 全フィールド |
| `aroma` | 香り表現テキストのみ | `{ wineId }` のみ |
| `appearance` | 外観表現テキストのみ | `{ wineId }` のみ |
| `taste` | 味わい表現テキストのみ | `{ wineId }` のみ |

- 正本メタデータは `overall` に集約。観点別 namespace は `wineId` のみ持ち、
  検索後に `fetch(ids)` で `overall` からハイドレートする（単一の真実源）。
- ワイン 1 件 = 4 ベクトル。個人利用なら無料枠（数千〜1万ベクトル目安）に十分収まる。
  正確な上限は Upstash 設定時に確認する。

`overall` の metadata フィールド:
- `name`（ワイン名）
- `producer`（生産者）
- `country` / `region` / `subregion` / `commune`（産地の階層）
- `vintage`（収穫年、数値。NV の場合は null 扱い）
- `importer`（輸入業者）
- `store`（購入店舗）
- `imageUrl`（ラベル画像の URL）
- `appearanceTerms` / `aromaTerms` / `tasteTerms`（JSA 表現タグの配列）
- `recordedAt`（記録日時。クライアント側から渡す）

## 4. 観点別検索（意味的 vs 構造的 — 本設計の核心）

観点を「意味的近さ」と「構造的近さ」に分け、別々の手段で実装する。
ここを混同すると「観点別」機能が静かに壊れる（例: ヴィンテージの近さを
埋め込み距離で測るのは無意味）。

- **香り / 外観 / 味わいが近い** → 意味的。該当 namespace をベクトル検索。
  bge-m3 が「カシス↔ブラックベリー」のような語間距離を捉える。
- **産地が近い** → 構造的。`country/region/subregion/commune` の階層を
  メタデータで持ち、**最長共通接頭辞**でランク（村一致 > 地区一致 > 地方一致 > 国一致）。
- **ヴィンテージが近い** → 構造的。`vintage` のメタデータ範囲フィルタ（例 ±5 年）
  ＋ `|Δyear|` でソート。

検索フロー（**発見・レコメンド中心**）:
1. `overall` で topK=1 → ベスト 1 件。
2. 指定観点の namespace / メタデータで近似 N 件（自分自身は除外）。
3. 結果カードを MCP App ウィジェットで描画。LLM が観点別の近さを文章化。

（フォールバック案: タグ集合の重複度＝Jaccard。ただし語間距離を捉えられないため
bge-m3 を主とし、重複度は補助に留める。）

## 5. 記録フロー（初回スコープ）

1. ユーザーがモバイルアプリでラベル画像を添付 → LLM の vision が文字を読む。
2. `record_wine` 確定前に**確認ウィジェット**を描画 → 抽出した
   {名前 / 生産者 / 産地 / 年 / 輸入業者} をユーザーが修正・確認
   （要件「格納前に正確性を確認」を満たす）。
3. 同ウィジェットで **JSA 表現を外観 / 香り / 味わいごとにタップ選択**
   （`get_jsa_taxonomy` がタームを供給。文字入力なし）。
4. 画像本体は**ウィジェット内のファイル選択 → `get_upload_url` で得た署名 URL へ
   直接アップロード**（R2 / Blob）。Vector には URL のみ保存。
5. 確定で `record_wine` → 4 つの namespace へ upsert。

### 既知のリスク（初回スコープで検証する点）
- モバイルアプリ上の画像受け渡し・MCP Apps のファイルアップロード挙動は
  **Claude と Codex で差がある可能性**。まず Claude モバイルで確実に動かし、
  Codex は後追いで検証する。

## 6. 前提タスク

- **JSA 表現 PDF の構造化**: 別途渡される日本ソムリエ協会の表現集 PDF を、
  外観 / 香り / 味わい → 各タームの構造化タクソノミー（JSON 等）にパースする。
  記録フローが動く前の独立タスク。`pdf` スキルで対応。

## 7. スコープ管理

- 初回 speckit 仕様 = **記録フローの縦切り**（画像アップロード→vision確認→
  JSA タップ選択→Upstash 保存まで端から端）。
- 検索フロー / 観点別提示 UI は次スコープ。
- speckit の正規フロー（constitution → specify → plan → tasks）を最初から回す。

## 8. セキュリティ / 運用メモ

- 署名付きアップロード URL は短命（数分）かつ単一用途にする。
- リモート MCP の HTTP 層は Helmet 等のセキュアヘッダを既定で適用する。
- Upstash / ストレージのトークンは環境変数で管理し、リポジトリに含めない。
