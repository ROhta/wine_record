# Phase 0 調査: 観点独立のワイン類似検索

一次情報は spec.md、001 の data-model/research（namespace 設計）、憲章（特に原則 IV）、
Upstash Vector 公式ドキュメント（Context7 `/websites/upstash_vector`・High）。

## D1. 構造的絞り込みの実装（approach A: ハイドレート後フィルタ）

- **Decision**: 観点クエリは観点別 namespace を意味検索（structural metadata は使わない）→ 候補 id を
  `overall` から `fetch` してメタデータをハイドレート → **メモリ内で exact フィルタ**（color/産地階層/vintage）。
  候補プールは観点ごとに `topK = min(corpus, 1000)`。
- **Rationale**: corpus が topK 上限（D6）以下なら観点ごとに**全件**取得でき、フィルタは exact かつ完全
  （取りこぼしゼロ）。観点別 namespace は `{wineId}` のみの lean なまま保て、**001 の write 経路を一切変えない**。
  原則 IV を満たす（構造は exact メタデータ一致で、ベクトル距離で代替しない）。単一ユーザー・数千件では
  候補数百件のハイドレート＋メモリ内フィルタは 1 秒以内（SC-005）。
- **Alternatives considered**:
  - **approach B**（観点別 namespace に color/産地/vintage を持たせ Upstash `filter` で取得時に絞る）→ 却下。
    リコールは正確だが、`buildAspectUpserts`（001）の write 経路に構造メタデータ追記＋**既存全レコードの再索引**が
    必要で、scale が無い今では原則 V 違反。**upgrade path として記録**: corpus が topK 上限（~1000）に近づき、かつ
    狭い構造フィルタで A のリコールが不足し始めたら B へ移行する（trigger 明記）。
  - 構造 id を先に確定して観点クエリを id 制限 → Upstash query は id allowlist 非対応のため不可。

## D2. 複数観点スコアの合成式（SC-002 の決定打）

- **Decision**: 総合スコア = `Σ_a (w_a · s_a) / Σ_a (w_a)`。ここで a は**クエリで指定された全観点**。
  ワインがある観点の表現を持たない場合 `s_a = 0`、ただし**その観点の重み w_a は分母に残す**。
  重み未指定は均等（各 1）。
- **Rationale**: 「両観点を満たすワイン > 片方のみ」（SC-002）を保証する唯一の正しい正規化。
  例（外観+味わい・均等）: 両方 0.8 のワイン → 0.8 ／ 味わいのみ 0.9 のワイン → (0+0.9)/2 = 0.45 → 両観点が上位。
  **誤りやすい版**（ワインが「持つ観点の重みだけ」で正規化）だと片方 0.9 が 0.9 のまま勝ち SC-002 違反。
- **Alternatives considered**: 観点スコアの単純和（件数バイアス）／最大値（合成にならない）→ いずれも SC-002 を保証せず却下。
- **0 除算（NaN）の排除**: 重みは検証で **> 0** に限定する（0 以下はエラー・data-model/contract C3/C9）。
  これにより指定観点の Σ(wₐ)>0 が保証され、`Σ(wₐsₐ)/Σ(wₐ)` は常に有限＝決定性（FR-011）も保たれる
  （観点を外したいなら重み 0 でなくその観点の句を渡さない）。
- **検証**: `combineScores.ts` の単体テストで SC-002・及び weights≤0 のエラーを**先に失敗させてから**実装する（原則 II）。

## D3. 決定性（FR-011 / SC-006）

- **Decision**: 結果は `(round(score, P) desc, wineId asc)` で安定ソート（P=固定精度、例 1e-6）。
- **Rationale**: コサインスコアは実行間で最下位ビットが揺れうる。固定精度に丸めてから比較し、同点は wineId
  （exact・一意）で決定的に並べる。これで再実行 100% 同順（SC-006）。
- **Alternatives considered**: 生スコアで比較 → float jitter で順序が揺れうるため却下。

## D4. 構造条件のみのクエリ（FR-012）

- **Decision**: 観点表現が無く構造条件のみのときは、`overall` を新メソッド `scan`（Upstash `range` で
  ページング列挙・includeMetadata）で全件取得 → メモリ内で exact フィルタ → **wineId 昇順**で返す（意味順位なし）。
- **Rationale**: Upstash `query` は vector/data 必須で、クエリベクトル無しの「フィルタだけ取得」はできない。
  `range` による列挙が正攻法。単一ユーザー・数千件なら全列挙＋フィルタは許容（SC-005）。
- **Alternatives considered**: ダミーベクトルで query → 意味順位が混入し FR-012（順位づけしない）に反するため却下。

## D5. namespace 間のスコア比較可能性

- **Decision**: 観点別スコアをそのまま重み付き平均してよい。
- **Rationale**: `overall` と観点別は**同一 Upstash index の別 namespace**で、埋め込みモデルは共通（bge-m3・
  dense・1024 次元）。返るスコアは同種のコサイン類似度で、namespace 間で同一スケール。よって加重平均が妥当。
- **Alternatives considered**: namespace ごとに z-score 正規化 → コーパス分布依存で決定性・単純さを損ねるため不要。

## D6. topK 上限と候補プール

- **Decision**: 観点クエリの `topK = min(corpus 件数, 1000)`。corpus 件数は概算でよい（多めに取って害なし）。
- **Rationale**: Upstash Vector の query topK 上限は 1000（既定）。corpus ≤ 1000 なら観点ごとに全件取得でき、
  approach A の exact フィルタが完全になる（D1）。corpus 件数は `overall` の概算（または固定 1000）でよい。
- **Alternatives considered**: 小さな固定 topK（例 10）→ 構造フィルタ後に候補が枯れるリコール欠落のため却下。

## D7. 観点を持たないワインの除外（US1 シナリオ3）

- **Decision**: 特別な処理は不要。`buildAspectUpserts`（001）は**表現が空の観点をスキップ**するため、観点別
  namespace にはその観点の表現を持つワインしか存在しない。よって観点クエリの結果に自然と現れない。
- **Rationale**: 既存の索引設計が「その観点を持たないワインは一致として数えない」を構造的に保証している。

## D8. テストのための seam（注入と fake パリティ）

- **Decision**: `VectorStore` に `scan(namespace): Promise<FetchedRecord[]>` を追加し、**フェイク実装にも同メソッドを
  足す**。検索オーケストレーション（searchWines）は `VectorStore` を注入で受け、ランキング・合成・フィルタ・
  決定性・FR-012 をフェイクで env/ネットワーク非依存に結合テストする。
- **Rationale**: 既存 `server.ts`/`recordWine` の依存注入パターン。実 Upstash 到達は quickstart の手動実機で担保。
  新メソッドを seam に追加し忘れると実装途中で詰まるため、計画段階で明記（原則 II・CI で成功パスまで検証）。

## 未解決（NEEDS CLARIFICATION）

なし。合成式の既定（重み付き平均・欠損=0・重みは分母に残す）と既定件数・決定性は spec の前提と SC から確定。
重みの既定（均等）・既定件数（例 10）は妥当なデフォルトとして data-model/contracts で確定する。
