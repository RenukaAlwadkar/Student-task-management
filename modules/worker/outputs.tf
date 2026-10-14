output "name" {
  description = "Worker name."
  value       = cloudflare_workers_script.this.name
}

output "id" {
  description = "Worker script ID."
  value       = cloudflare_workers_script.this.id
}
