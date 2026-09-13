import { createGoldApiClient } from './gold-api.js';

// Only the secret ARN comes from the environment; the key is loaded at runtime.
export async function handler() {
  return createGoldApiClient().getPrices();
}
