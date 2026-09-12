# Terraform state bootstrap

This stack will create the S3 bucket used to store Terraform state. It must be applied before configuring the remote backend for the remaining infrastructure.

Copy `demo.tfvars.example` to the ignored `demo.tfvars` file and replace the placeholder bucket name with a globally unique name before applying.
