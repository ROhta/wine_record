# コントラクト: `search_wines` MCP ツール

読み取り専用の検索ツール。自然文の観点表現と構造条件を**構造化入力**で受け、観点独立の意味検索＋構造的
絞り込みの結果を返す（自然文→構造化の分解は接続先 LLM が担う・spec 前提・原則 I）。

## 入力スキーマ

すべて任意だが、**観点表現（appearance/aroma/taste）または構造条件（region/vintage/color）の最低ひとつが必須**。

```jsonc
{
  "appearance": "澄んだ輝きのある",          // 任意・外観の表現（自然文可）
  "aroma":      "すみれやヴァニラ",            // 任意・香りの表現
  "taste":      "ビロードのようなタンニン",     // 任意・味わいの表現
  "region":  { "country": "スペイン", "region": null, "subregion": null, "commune": null }, // 任意・構造条件
  "vintage": 2019,                            // 任意・number / "NV" / null
  "color":   "red",                           // 任意・"white" | "red"
  "weights": { "appearance": 1, "taste": 2 }, // 任意・観点重み（≥0）。未指定観点は 1
  "limit":   10                                // 任意・整数 ≥1。未指定は既定 10
}
```

## 出力

成功（観点クエリあり）:

```jsonc
{
  "items": [
    {
      "wineId": "…",
      "name": "…", "producer": "…",
      "region": { "country": "スペイン", "region": "リオハ", "subregion": null, "commune": null },
      "vintage": 2019, "color": "red", "imageUrl": null,
      "score": 0.78,                                  // 総合スコア（D2）
      "aspectScores": { "appearance": 0.81, "taste": 0.75 } // 指定観点の内訳（FR-006）
    }
  ]
}
```

成功（構造条件のみ・FR-012）: `score`/`aspectScores` は付かず、`items` は wineId 昇順。
検証失敗: `isError` ＋ `{ errors: [{field, message}] }`（既存 3 ツールと同形）。

## 検索セマンティクス（実装が満たすべき契約＝テストオラクル）

| 規則 | 要件 | 期待 |
|---|---|---|
| C1 観点独立 | FR-001 | 観点 a の句は namespace a のみで評価。観点をまたいで表現を混ぜない |
| C2 合成順位 | FR-002/003・**SC-002** | `score = Σ(w_a·s_a)/Σ(w_a)`（指定全観点・欠損 s_a=0・重みは分母に残す）。**両観点を満たすワイン > 片方のみ** |
| C3 重み | FR-003 | 重み反映。未指定は均等（各 1）。**0 以下（負値・0）は検証エラー** → 指定観点の Σ(wₐ)>0 を保証し合成式の NaN を防ぐ |
| C4 構造 exact | FR-004・**SC-003** | region 階層・vintage・color は exact 一致でフィルタ。条件外の混入ゼロ。ベクトル距離で代替しない |
| C5 言い換え | FR-005・SC-004 | JSA 完全一致でない自然文でも意味的に近い表現を拾う（埋め込み検索） |
| C6 内訳 | FR-006 | 各件に総合＋観点別スコアを返す |
| C7 表示情報 | FR-007 | name/producer/region/vintage/color/imageUrl を `overall` から復元して返す |
| C8 件数 | FR-008 | `limit` 件まで。未指定は既定 10 |
| C9 検証 | FR-009 | 観点も構造も空 → フィールド別エラー。weights≤0（0 含む）・limit<1 → エラー |
| C10 読み取り専用 | FR-010 | upsert/delete を呼ばない（副作用なし） |
| C11 決定性 | FR-011・**SC-006** | `(round(score,P) desc, wineId asc)`。再実行 100% 同順 |
| C12 構造のみ | FR-012 | 観点表現なし＝構造一致一覧を wineId 順で返す（意味順位なし） |
| C13 空結果 | エッジ | 空コーパス・合致ゼロは `items:[]`（エラーにしない） |

## 合格条件（このコントラクトの「グリーン」）

- C2（SC-002）・C4（SC-003）・C11（SC-006）・C1（FR-001）・C12（FR-012）を検証する**先行テスト**が緑
  （フェイク `VectorStore` で env 非依存）。実機 quickstart で SC-001/004/005 を確認。
