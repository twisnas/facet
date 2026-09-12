# Price fetcher

Scheduled Lambda responsible for retrieving gold, silver, and platinum prices and storing the latest successful values.

Currently implemented: a standalone TypeScript provider client for
[GoldAPI.io](https://www.goldapi.io/). Lambda handling, caching, and infrastructure
will follow in separate changes.

Use Node.js 22 or newer:

```bash
npm ci
npm test
```

Tests compile the service and use mocked HTTP responses; no API key or network
access is needed. There are no runtime dependencies.

```ts
import { createGoldApiClient } from './src/gold-api.js';

const client = createGoldApiClient({ apiKey: process.env.GOLD_API_KEY ?? '' });
const prices = await client.getPrices();
```

The caller supplies the API key; keep it out of source control. The client sends
it in `x-access-token` to `https://www.goldapi.io/api/{metal}/USD` for `XAU`, `XAG`,
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
