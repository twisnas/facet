# Price fetcher

Scheduled Lambda responsible for retrieving gold, silver, and platinum prices and storing the latest successful values.

Implemented: a TypeScript provider client for [GoldAPI.io](https://www.goldapi.io/)
and a Lambda handler that returns all three prices. Caching and scheduling will
follow in separate changes. The demo Terraform configuration provisions the
service secret and optionally the Lambda.

Use Node.js 22 or newer:

```bash
npm ci
npm test
```

Tests compile the service and use mocked HTTP responses; no API key or network
access is needed. There are no runtime dependencies.

```ts
import { createGoldApiClient } from './src/gold-api.js';

const client = createGoldApiClient();
const prices = await client.getPrices();
```

The client reads the service-owned key from `GOLD_API_KEY` and fails immediately
if it is missing, blank, or contains embedded newlines. Callers cannot supply a
key through client options or the Lambda event. For local use, set this variable
in your shell; never commit it. In AWS, Terraform injects the current plain-string
Secrets Manager value into this variable on the price-fetcher Lambda only.
See [deployment instructions](../../terraform/environments/demo/README.md).
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
symbol and HTTP status when available. There are no automatic retries or partial
results.
