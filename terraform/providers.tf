# ==============================================================================
# Cloudflare Terraform Provider Configuration
# Project: Automated Deployment of Serverless Student Task Management Application
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

locals {
  resolved_api_token  = var.api_token != "" ? var.api_token : var.cloudflare_api_token
  resolved_account_id = var.account_id != "" ? var.account_id : var.cloudflare_account_id
}

# Configure the Cloudflare Provider.
# Authentication is achieved via an API Token.
# The provider can read 'api_token' directly from the variable or automatically
# from the CLOUDFLARE_API_TOKEN environment variable.
provider "cloudflare" {
  api_token = local.resolved_api_token != "" ? local.resolved_api_token : null
}
