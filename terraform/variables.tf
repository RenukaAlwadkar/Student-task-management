# ==============================================================================
# Terraform Input Variables Definition
# ==============================================================================

variable "account_id" {
  type        = string
  description = "The Cloudflare Account ID where resources will be provisioned."
  default     = ""
}

variable "cloudflare_account_id" {
  type        = string
  description = "The Cloudflare Account ID (alias for account_id)."
  default     = ""
}

variable "api_token" {
  type        = string
  description = "Cloudflare API Token with Workers Scripts and KV Storage edit permissions."
  sensitive   = true
  default     = ""
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API Token (alias for api_token)."
  sensitive   = true
  default     = ""
}

variable "worker_name" {
  type        = string
  description = "The name of the Cloudflare Worker script."
  default     = "student-task-manager"
}

variable "kv_namespace_name" {
  type        = string
  description = "The name / title of the Cloudflare Workers KV namespace."
  default     = "student_tasks"
}

variable "environment" {
  type        = string
  description = "Target deployment environment (e.g., dev, test, production)."
  default     = "production"

  validation {
    condition     = contains(["dev", "test", "production"], var.environment)
    error_message = "Environment must be one of: 'dev', 'test', 'production'."
  }
}

variable "enable_subdomain" {
  type        = bool
  description = "Whether to enable the workers.dev subdomain route for public access."
  default     = true
}
