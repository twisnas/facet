# Facet

Facet is a serverless application for retrieving precious-metal prices and applying customer-defined pricing formulas.

## Repository layout

- `frontend/` - React + TypeScript application built as static assets for S3 and CloudFront.
- `services/` - Lambda services for price ingestion and quote calculation.
- `terraform/` - AWS infrastructure and Terraform backend configuration.
- `shared/` - Contracts and shared domain types.

## Frontend development

```bash
cd frontend
npm run dev
```

The AWS deployment configuration will be added after the initial product contracts are defined.
