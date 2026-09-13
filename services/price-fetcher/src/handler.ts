import { createGoldApiClient } from './gold-api.js';
import { getSecretString } from './utils/secrets.js';

let client: ReturnType<typeof createGoldApiClient> | undefined;

export async function handler() {
  if (!client) {
    const secretArn = process.env.GOLD_API_SECRET_ARN?.trim() ?? '';
    if (!secretArn || /[\r\n]/.test(secretArn)) {
      throw new TypeError('GOLD_API_SECRET_ARN must be non-empty and contain no newlines');
    }
    client = createGoldApiClient({ getApiKey: () => getSecretString(secretArn) });
  }
  return client.getPrices();
}
