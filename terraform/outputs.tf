# ==============================================================================
# Terraform Outputs
# Step 11: Expose critical deployment details after successful provisioning
# ==============================================================================

output "worker_name" {
  description = "The deployed Cloudflare Worker script name."
  value       = cloudflare_workers_script.student_task_manager.name
}

output "kv_namespace_id" {
  description = "The unique identifier of the provisioned Workers KV namespace."
  value       = cloudflare_workers_kv_namespace.student_tasks.id
}

output "kv_namespace_title" {
  description = "The title of the provisioned Workers KV namespace."
  value       = cloudflare_workers_kv_namespace.student_tasks.title
}

output "environment" {
  description = "The deployment environment for the resources."
  value       = var.environment
}

output "application_url" {
  description = "The public web application URL on the workers.dev domain."
  value       = "https://${cloudflare_workers_script.student_task_manager.name}.workers.dev"
}

output "api_endpoints" {
  description = "Summary of available REST API endpoints exposed by the Worker."
  value = {
    "list_tasks"  = "GET  https://${cloudflare_workers_script.student_task_manager.name}.workers.dev/api/tasks"
    "create_task" = "POST https://${cloudflare_workers_script.student_task_manager.name}.workers.dev/api/tasks"
    "get_task"    = "GET  https://${cloudflare_workers_script.student_task_manager.name}.workers.dev/api/tasks/{id}"
    "update_task" = "PUT  https://${cloudflare_workers_script.student_task_manager.name}.workers.dev/api/tasks/{id}"
    "delete_task" = "DELETE https://${cloudflare_workers_script.student_task_manager.name}.workers.dev/api/tasks/{id}"
  }
}
