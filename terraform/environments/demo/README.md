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
receives it as `GOLD_API_KEY`; the frontend and quote API do not need it.

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
   zip -r dist/price-fetcher.zip package.json dist/src
   ```

4. Set `price_fetcher_package_path` in the ignored `demo.tfvars` to the ZIP's
   absolute path, then plan and apply the demo environment. Terraform reads
   `AWSCURRENT` and injects it into the Lambda environment. The Terraform deployment
   identity needs `secretsmanager:GetSecretValue` on this secret. The Lambda role
   needs only log access because injection happens during deployment.

The handler is `dist/src/handler.handler` using Node.js 22. It can be invoked
manually and returns normalized prices; scheduling and persistent caching are
not configured yet. Rebuild the ZIP after changing service code.

After rotating the key in Secrets Manager, run Terraform plan/apply again to
update the Lambda environment. Rotation alone does not update deployed variables.

The secret value is sensitive in Terraform output, but **is still stored in state
and saved plans** because it is used in a Lambda environment variable. Restrict
access to the state bucket, plans, and Lambda configuration. Do not commit or
share these artifacts. AWS encrypts Lambda environment variables at rest; see
[AWS environment variable documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html).
