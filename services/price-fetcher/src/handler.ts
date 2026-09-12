import { createGoldApiClient } from './gold-api.js';

// Credentials come exclusively from the Lambda environment, never the event.
export async function handler() {
  return createGoldApiClient().getPrices();
}
