# Price fetcher

Scheduled Lambda responsible for retrieving gold, silver, and platinum prices and storing the latest successful values.

Implemented: a TypeScript provider client for [GoldAPI.io](https://www.goldapi.io/)
and a Lambda handler that returns all three prices. Caching and scheduling will
follow in separate changes. The demo Terraform configuration provisions the
service secret and optionally the Lambda.

Use Node.js 22 or newer:

```bash
npm ci
npm run check
```

`npm run check` runs Oxlint, Prettier verification, and the tests. Use
`npm run lint` for linting, `npm run format:check` to verify formatting, and
`npm run format` to apply it. Source and test files are linted; generated output
and dependencies are excluded from formatting. Pull requests run the same checks
in `.github/workflows/price-fetcher-checks.yml`.

Tests compile the service and mock HTTP and Secrets Manager responses; no API key or network
access is needed. The AWS Secrets Manager SDK is a runtime dependency.

```ts
import { createGoldApiClient } from './src/gold-api.js';

const client = createGoldApiClient();
const prices = await client.getPrices();
```

The client reads `GOLD_API_SECRET_ARN` from the environment and loads the plain
secret string from AWS Secrets Manager at runtime. Missing ARN configuration
fails immediately; missing, blank, binary-only, or invalid secret values and AWS
lookup failures reject before any Gold API request. Error messages omit secret
contents and SDK error details. Callers and Lambda events cannot supply the key.
For local use, configure the ARN, AWS region, and AWS credentials with permission
to read that secret. Terraform handles only the secret metadata and ARN.

Each client shares one lookup across its requests. The handler creates a fresh
client per invocation, picking up `AWSCURRENT` without redeployment after rotation.
Failed lookups are not cached. Secret retrieval has its own `timeoutMs` deadline
and permits up to two SDK attempts. See
[deployment instructions](../../terraform/environments/demo/README.md).
The client sends the key in `x-access-token` to `https://www.goldapi.io/api/{metal}/USD` for `XAU`, `XAG`,
and `XPT`. `getPrice(symbol)` retrieves one metal; `getPrices()` returns all three
in that order and rejects if any request fails.

Each normalized result contains `symbol`, `currency` (`USD`), `price` (the
provider's spot price per troy ounce, without rounding), and `updatedAt` (UTC ISO
timestamp converted from the provider's Unix seconds). Old timestamps are
preserved; freshness decisions belong to the future cache layer.

Requests time out after 5 seconds, including reading the response body. Tests or
callers can override `fetch` and `timeoutMs`. HTTP errors, network errors, invalid
JSON, and malformed price data reject with `GoldApiError`, including the affected
symbol and HTTP status when available. Gold API HTTP requests have no automatic retries or partial results.
