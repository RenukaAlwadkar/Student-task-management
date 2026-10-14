variable "account_id" {
  type        = string
  description = "Cloudflare Account ID."
}

variable "title" {
  type        = string
  description = "Base title for the KV namespace."
  default     = "student_tasks"
}

variable "environment" {
  type        = string
  description = "Target deployment environment."
  default     = "production"
}
