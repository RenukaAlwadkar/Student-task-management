output "id" {
  description = "The ID of the KV namespace."
  value       = cloudflare_workers_kv_namespace.this.id
}

output "title" {
  description = "The title of the KV namespace."
  value       = cloudflare_workers_kv_namespace.this.title
}
