variable "account_id" {
  type        = string
  description = "Cloudflare Account ID."
}

variable "name" {
  type        = string
  description = "Worker script name."
  default     = "student-task-manager"
}

variable "script_path" {
  type        = string
  description = "Path to the JavaScript worker file."
}

variable "environment" {
  type        = string
  description = "Target deployment environment."
  default     = "production"
}

variable "kv_namespace_id" {
  type        = string
  description = "ID of the KV namespace to bind."
}

variable "kv_binding_name" {
  type        = string
  description = "Environment variable name for the KV namespace inside Worker runtime."
  default     = "TASKS_KV"
}
