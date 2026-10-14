# ==============================================================================
# Reusable Terraform Module: Cloudflare Workers KV
# modules/kv/main.tf
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }
}

resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.account_id
  title      = var.environment == "production" ? var.title : "${var.title}_${var.environment}"
}
