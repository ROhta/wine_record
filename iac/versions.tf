terraform {
  required_version = ">= 1.9"

  # State は HCP Terraform（リモート）で管理する。
  # organization / workspace は事前に HCP で作成しておくこと（iac/README.md 参照）。
  # organization 名は実際の HCP 組織に合わせて調整する。
  cloud {
    organization = "rohta"

    workspaces {
      name = "wine_records"
    }
  }

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3"
    }
    # Auth0（US 003・MCP コネクタ OAuth のテナント設定を IaC 管理）。
    # subject_type_authorization に対応する版が必要（`terraform init` 時に lock で固定）。
    auth0 = {
      source  = "auth0/auth0"
      version = "~> 1.0"
    }
  }
}
