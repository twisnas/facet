import { createGoldApiClient } from './gold-api.js';

// Retain the client and its bounded secret cache across warm invocations.
let client: ReturnType<typeof createGoldApiClient> | undefined;

export async function handler() {
  client ??= createGoldApiClient();
  return client.getPrices();
}
