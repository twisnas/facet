terraform {
  backend "s3" {
    bucket       = "facet-terraform-state-replace-me"
    key          = "facet/demo/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}