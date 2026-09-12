terraform {
  backend "s3" {
    key          = "facet/demo/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}