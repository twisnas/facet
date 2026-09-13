# Demo environment

The demo environment will compose the Facet AWS modules for the free-tier demonstration account.

## Initialize

This environment stores its state in the bootstrap S3 bucket. Use the `facet-admin` AWS SSO profile:

```bash
AWS_PROFILE=facet-admin terraform init -backend-config=backend.hcl
AWS_PROFILE=facet-admin terraform plan -var-file=demo.tfvars
```

Create the ignored `backend.hcl` from `backend.hcl.example` and `demo.tfvars` from `demo.tfvars.example` before running these commands. Keep the real state bucket name and allowed IP in those ignored files. The demo provisions a private S3 frontend bucket and a CloudFront distribution protected by an AWS WAF allowlist. The frontend bucket is intentionally empty until the React build is deployed.


## Price fetcher and Gold API key

One service-owned key is stored in `facet/demo/gold-api-key` in AWS Secrets
Manager. No customer request supplies this key. Only the price-fetcher Lambda
receives its ARN as `GOLD_API_SECRET_ARN` and reads the key at runtime. The
frontend and quote API receive neither the key nor secret read permission.

1. Apply this environment with `price_fetcher_package_path` left at its default
   `null`. This creates the secret container without creating a Lambda or reading
   a secret value.
2. In the AWS Secrets Manager console, set the secret's value to the API key as a
   **plain string**, not JSON. Terraform does not create or manage secret versions.
   The `gold_api_key_secret_arn` output identifies the secret.
3. Build the deployment ZIP from the repository root:

   ```bash
   cd services/price-fetcher
   npm ci
   npm run build
   npm ci --omit=dev
   zip -r dist/price-fetcher.zip package.json dist/src node_modules
   npm ci
   ```

4. Set `price_fetcher_package_path` in the ignored `demo.tfvars` to the ZIP's
   absolute path, then plan and apply the demo environment. Terraform passes only
   the secret ARN to the Lambda. Its execution role has `secretsmanager:GetSecretValue`
   on that exact secret, plus log access. Terraform does not read the secret value.

The handler is `dist/src/handler.handler` using Node.js 22. It can be invoked
manually and returns normalized prices; scheduling and persistent caching are
not configured yet. Rebuild the ZIP after changing service code.

The Lambda caches the key in memory across warm invocations for five minutes.
After rotation, the first request after cache expiry reloads `AWSCURRENT`.
No Terraform apply is needed for rotation. Populate the secret before invoking the
Lambda; a missing secret version causes an explicit runtime error.

Terraform does not read or store the key with this configuration. If the old
configuration was previously applied, earlier state versions and saved plans may
still contain the old key. Rotate that key and handle those existing artifacts
according to your state retention policy; this refactor does not erase them.
