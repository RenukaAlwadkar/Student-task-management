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

# Configure the Cloudflare Provider.
# Authentication is achieved via an API Token.
# The provider can read 'api_token' directly from the variable or automatically
# from the CLOUDFLARE_API_TOKEN environment variable.
provider "cloudflare" {
  api_token = var.cloudflare_api_token != "" ? var.cloudflare_api_token : null
}
