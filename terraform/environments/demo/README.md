# Demo environment

The demo environment will compose the Facet AWS modules for the free-tier demonstration account.

## Initialize

This environment stores its state in the bootstrap S3 bucket. Use the `facet-admin` AWS SSO profile:

```bash
AWS_PROFILE=facet-admin terraform init
AWS_PROFILE=facet-admin terraform plan -var-file=demo.tfvars.example
```

The demo currently provisions a private S3 frontend bucket and a CloudFront distribution protected by an AWS WAF allowlist containing the configured home IP. The frontend bucket is intentionally empty until the React build is deployed.
