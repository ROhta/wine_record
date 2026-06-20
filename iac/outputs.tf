output "project_id" {
  description = "Vercel プロジェクト ID"
  value       = vercel_project.wine_record.id
}

output "production_url" {
  description = "本番デプロイの既定ドメイン（MCP コネクタ接続先は https://<this>/mcp）"
  value       = "https://${vercel_project.wine_record.name}-${var.vercel_team}.vercel.app"
}
