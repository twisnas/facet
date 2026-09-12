# Project instructions

These instructions apply throughout this repository. Keep this file updated with
durable project decisions and explicit user preferences as work progresses.
Never store credentials or other sensitive values here.

## Workflow preferences

- Implement requested changes and run checks appropriate to the affected code.
- Commit completed, verified changes as you go on the current feature branch.
  The user has explicitly requested this; do not ask again for routine commits.
- Stage only files belonging to the task. Preserve unrelated user changes.
- Do not push, merge, or deploy unless requested or already authorized.
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
- Inject the key into the appropriate Lambda environment as `GOLD_API_KEY`.
  The client reads this variable directly; callers and request events must not
  supply credentials.
- Only services that call GoldAPI.io should receive the key. Never expose it to
  the frontend or commit it to source control.
- The current demo Terraform configuration injects the secret at deployment
  time, which also stores the value in Terraform state. Secret rotation requires
  another Terraform plan/apply to update the Lambda environment.
- Follow `terraform/environments/demo/README.md` for secret initialization and
  Lambda packaging. Scheduling and persistent price caching are not implemented.

## Validation

- Prefer `describe()` suites to group related tests by component and behavior.

- Price fetcher: `npm test --prefix services/price-fetcher` (includes TypeScript
  compilation; tests use mocked HTTP responses).
- Terraform changes: run `terraform fmt -check -recursive`, validate the affected
  environment, and run TFLint with the root `.tflint.hcl` configuration.
- Run `git diff --check` before committing. Report checks that could not run.

## Maintaining these instructions

- Record new explicit workflow preferences and lasting architectural decisions.
- Update or remove stale details when implementation changes.
- Keep temporary plans and task progress out of this file; use commit history
  and project documentation for detailed implementation records.
