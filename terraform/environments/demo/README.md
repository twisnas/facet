# Demo environment

The demo environment will compose the Facet AWS modules for the free-tier demonstration account.

## Initialize

This environment stores its state in the bootstrap S3 bucket. Use the `facet-admin` AWS SSO profile:

```bash
AWS_PROFILE=facet-admin terraform init -backend-config=backend.hcl
AWS_PROFILE=facet-admin terraform plan -var-file=demo.tfvars
```

Create the ignored `backend.hcl` from `backend.hcl.example` and `demo.tfvars` from `demo.tfvars.example` before running these commands. Keep the real state bucket name and allowed IP in those ignored files. The demo provisions a private S3 frontend bucket and a CloudFront distribution protected by an AWS WAF allowlist. The frontend bucket is intentionally empty until the React build is deployed.
