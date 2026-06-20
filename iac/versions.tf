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
  }
}
