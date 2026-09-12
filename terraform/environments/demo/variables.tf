variable "aws_region" {
  description = "AWS region for the Facet demo environment."
  type        = string
  default     = "us-east-1"
}

variable "allowed_ip_cidr" {
  description = "Public IPv4 CIDR allowed to access the demo site."
  type        = string

  validation {
    condition     = can(cidrhost(var.allowed_ip_cidr, 0))
    error_message = "allowed_ip_cidr must be a valid IPv4 CIDR block."
  }
}