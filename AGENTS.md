# Project instructions

These instructions apply throughout this repository. Keep this file updated with
durable project decisions and explicit user preferences as work progresses.
Never store credentials or other sensitive values here.

## Workflow preferences

- Implement requested changes and run checks appropriate to the affected code.
- Commit completed, verified changes as you go on the current feature branch.
  The user has explicitly requested this; do not ask again for routine commits.
- Push completed commits to the feature branch's remote so the PR stays updated.
  The user has authorized routine pushes as part of this workflow. Never force
  push without explicit authorization.
- Stage only files belonging to the task. Preserve unrelated user changes.
- Do not merge or deploy unless requested or already authorized.
- Honor read-only requests: do not edit files or create commits for those tasks.
- Report what changed, validation results, and the commit identifier. Clearly
  distinguish local implementation from deployed infrastructure.

## Project context

- Facet retrieves precious-metal prices and applies customer pricing formulas.
- `frontend/` contains the React and TypeScript frontend.
- `services/price-fetcher/` contains the GoldAPI.io client and Lambda handler.
- `services/quote-api/` is reserved for quote calculation.
- `terraform/` contains AWS infrastructure and backend configuration.
- `shared/` is reserved for shared contracts and domain types.

## Gold API credentials

- Use one service-owned Gold API key, stored in AWS Secrets Manager.
- Pass only `GOLD_API_SECRET_ARN` in the Lambda environment. Load the plain-string
  key from Secrets Manager at runtime with access scoped to that secret.
- Never read secret values through Terraform or place them in Lambda environment
  variables, Terraform state, frontend code, or request events.
- The handler reuses its client across warm invocations. Cache `AWSCURRENT` in
  memory for five minutes and share in-flight lookups. Rotation takes effect on
  the first request after cache expiry without redeployment.
- Follow `terraform/environments/demo/README.md` for secret initialization and
  Lambda packaging. Scheduling and persistent price caching are not implemented.

## Validation

- Prefer `describe()` suites to group related tests by component and behavior.

- Before committing JS/TS changes, run the affected package's lint and formatting
  checks as well as its relevant tests. Whitespace checks are not a substitute.
- Price fetcher: `npm run check --prefix services/price-fetcher` runs lint,
  formatting verification, TypeScript compilation, and mocked HTTP tests.
  Use `npm run format --prefix services/price-fetcher` to apply formatting.
- Terraform changes: run `terraform fmt -check -recursive`, validate the affected
  environment, and run TFLint with the root `.tflint.hcl` configuration.
- Run `git diff --check` before committing. Report checks that could not run.

## Maintaining these instructions

- Record new explicit workflow preferences and lasting architectural decisions.
- Update or remove stale details when implementation changes.
- Keep temporary plans and task progress out of this file; use commit history
  and project documentation for detailed implementation records.
