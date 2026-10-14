# ==============================================================================
# Main Infrastructure as Code Resources
# Provisions: Cloudflare Workers KV Namespace & Cloudflare Worker Script with Binding
# ==============================================================================

# 1. Cloudflare Workers KV Namespace (Step 8)
# Provides globally distributed key-value storage for student task records.
resource "cloudflare_workers_kv_namespace" "student_tasks" {
  account_id = var.cloudflare_account_id
  title      = var.environment == "production" ? var.kv_namespace_name : "${var.kv_namespace_name}_${var.environment}"
}

# 2. Cloudflare Worker Script (Step 9 & 10)
# Deploys serverless JavaScript logic for REST API CRUD and application interface.
resource "cloudflare_workers_script" "student_task_manager" {
  account_id         = var.cloudflare_account_id
  name               = var.environment == "production" ? var.worker_name : "${var.worker_name}-${var.environment}"
  content            = file("${path.module}/../application/worker.js")
  module             = true
  compatibility_date = "2024-04-01"

  # Step 10: Connect Worker to KV via Binding
  kv_namespace_binding {
    name         = "TASKS_KV"
    namespace_id = cloudflare_workers_kv_namespace.student_tasks.id
  }

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
}
