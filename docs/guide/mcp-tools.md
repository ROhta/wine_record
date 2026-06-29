# MCP ツール

このサーバーが公開する MCP ツールの一覧。

| ツール | 役割 | 副作用 |
| --- | --- | --- |
| `preview_record` | 下書きを正規化・検証し「保存される内容」をテキストで返す（保存前確認） | なし |
| `record_wine` | 確認済みの記録を Upstash Vector へ保存（明示承認後にのみ呼ぶ） | upsert |
| `get_jsa_taxonomy` | `color`（white/red）別・カテゴリ別の JSA 表現語彙を返す | なし |
| `search_wines` | 記録済みワインを観点別（外観/香り/味わい）に意味検索し、産地・ヴィンテージ・色で構造的に絞り込む（読み取り専用・004） | なし |

契約の詳細は [`specs/001-record-wine/contracts/mcp-tools.md`](../../specs/001-record-wine/contracts/mcp-tools.md)、[`specs/004-wine-aspect-search/contracts/search-wines-tool.md`](../../specs/004-wine-aspect-search/contracts/search-wines-tool.md)。
