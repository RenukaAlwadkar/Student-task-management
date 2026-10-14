# ==============================================================================
# Reusable Terraform Module: Cloudflare Worker
# modules/worker/main.tf
# ==============================================================================

resource "cloudflare_workers_script" "this" {
  account_id         = var.account_id
  name               = var.environment == "production" ? var.name : "${var.name}-${var.environment}"
  content            = file(var.script_path)
  module             = true
  compatibility_date = "2024-04-01"

  kv_namespace_binding {
    name         = var.kv_binding_name
    namespace_id = var.kv_namespace_id
  }

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
}
