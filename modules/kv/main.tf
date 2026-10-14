# ==============================================================================
# Reusable Terraform Module: Cloudflare Workers KV
# modules/kv/main.tf
# ==============================================================================

resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.account_id
  title      = var.environment == "production" ? var.title : "${var.title}_${var.environment}"
}
