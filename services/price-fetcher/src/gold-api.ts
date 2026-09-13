export const METAL_SYMBOLS = ['XAU', 'XAG', 'XPT'] as const;
export type MetalSymbol = (typeof METAL_SYMBOLS)[number];

export interface MetalPrice {
  symbol: MetalSymbol;
  currency: 'USD';
  price: number;
  updatedAt: string;
}

export class GoldApiError extends Error {
  constructor(
    public readonly symbol: MetalSymbol,
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(`Gold API ${symbol}: ${message}`, options);
    this.name = 'GoldApiError';
  }
}

interface ClientOptions {
  getApiKey: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function normalize(value: unknown, symbol: MetalSymbol): MetalPrice {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GoldApiError(symbol, 'invalid response');
  }
  const data = value as Record<string, unknown>;
  if (
    data.metal !== symbol ||
    data.currency !== 'USD' ||
    typeof data.price !== 'number' ||
    !Number.isFinite(data.price) ||
    data.price <= 0 ||
    typeof data.timestamp !== 'number' ||
    !Number.isSafeInteger(data.timestamp) ||
    data.timestamp <= 0 ||
    !Number.isFinite(new Date(data.timestamp * 1_000).getTime())
  ) {
    throw new GoldApiError(symbol, 'invalid price, symbol, currency, or timestamp');
  }
  return {
    symbol,
    currency: 'USD',
    price: data.price,
    updatedAt: new Date(data.timestamp * 1_000).toISOString(),
  };
}

export function createGoldApiClient(options: ClientOptions) {
  const fetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError('timeoutMs must be a positive 32-bit integer');
  }

  async function getPrice(symbol: MetalSymbol): Promise<MetalPrice> {
    if (!METAL_SYMBOLS.includes(symbol)) {
      throw new RangeError('Unsupported metal symbol');
    }
    const apiKey = (await options.getApiKey()).trim();
    if (!apiKey || /[\r\n]/.test(apiKey)) {
      throw new Error('Gold API key must be non-empty and contain no newlines');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
        headers: { Accept: 'application/json', 'x-access-token': apiKey },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new GoldApiError(symbol, `HTTP ${response.status}`, response.status);
      }
      return normalize(await response.json(), symbol);
    } catch (cause) {
      if (cause instanceof GoldApiError) throw cause;
      throw new GoldApiError(
        symbol,
        controller.signal.aborted ? 'request timed out' : 'request or JSON decoding failed',
        undefined,
        { cause },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    getPrice,
    // Reject the batch if any metal fails; never return an incomplete snapshot.
    getPrices: (): Promise<MetalPrice[]> => Promise.all(METAL_SYMBOLS.map(getPrice)),
  };
}
