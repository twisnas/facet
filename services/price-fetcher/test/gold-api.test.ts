import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { createGoldApiClient, GoldApiError, METAL_SYMBOLS } from '../src/gold-api.js';

describe('createGoldApiClient', () => {
  const payload = { metal: 'XAU', currency: 'USD', price: 2345.1234, timestamp: 1_700_000_000 };
  const clientWith = (body: unknown) =>
    createGoldApiClient({
      getApiKey: async () => 'test-key',
      fetch: async () => Response.json(body),
    });

  describe('requests and normalization', () => {
    test('requests all metals with authentication and normalizes without rounding', async () => {
      const urls: string[] = [];
      const client = createGoldApiClient({
        getApiKey: async () => 'test-key',
        fetch: async (input, init) => {
          urls.push(String(input));
          assert.equal(new Headers(init?.headers).get('x-access-token'), 'test-key');
          assert.equal(new Headers(init?.headers).get('Accept'), 'application/json');
          assert.ok(init?.signal instanceof AbortSignal);
          const metal = String(input).split('/').at(-2);
          return Response.json({ ...payload, metal, ignored: 'provider-specific field' });
        },
      });
      assert.deepEqual(
        await client.getPrices(),
        METAL_SYMBOLS.map((symbol) => ({
          symbol,
          currency: 'USD',
          price: payload.price,
          updatedAt: '2023-11-14T22:13:20.000Z',
        })),
      );
      assert.deepEqual(
        urls,
        METAL_SYMBOLS.map((symbol) => `https://www.goldapi.io/api/${symbol}/USD`),
      );
    });

    test('preserves old provider timestamps for the future cache layer', async () => {
      const price = await clientWith({ ...payload, timestamp: 1 }).getPrice('XAU');
      assert.equal(price.updatedAt, '1970-01-01T00:00:01.000Z');
    });
  });

  describe('response validation', () => {
    for (const [label, body] of Object.entries({
      null: null,
      array: [],
      'provider error': { error: 'Invalid API key' },
      'wrong metal': { ...payload, metal: 'XAG' },
      'wrong currency': { ...payload, currency: 'EUR' },
      'missing currency': { ...payload, currency: undefined },
      'missing price': { ...payload, price: undefined },
      'string price': { ...payload, price: '2345' },
      'zero price': { ...payload, price: 0 },
      'negative price': { ...payload, price: -1 },
      'missing timestamp': { ...payload, timestamp: undefined },
      'string timestamp': { ...payload, timestamp: '1700000000' },
      'negative timestamp': { ...payload, timestamp: -1 },
      'fractional timestamp': { ...payload, timestamp: 1.5 },
      'out-of-range timestamp': { ...payload, timestamp: Number.MAX_SAFE_INTEGER },
    })) {
      test(`rejects ${label}`, async () => {
        await assert.rejects(clientWith(body).getPrice('XAU'), GoldApiError);
      });
    }

    for (const price of [NaN, Infinity, -Infinity]) {
      test(`rejects non-finite price ${price}`, async () => {
        const client = createGoldApiClient({
          getApiKey: async () => 'test-key',
          fetch: async () => ({ ok: true, json: async () => ({ ...payload, price }) }) as Response,
        });
        await assert.rejects(client.getPrice('XAU'), GoldApiError);
      });
    }
  });

  describe('error handling', () => {
    for (const status of [401, 429, 500]) {
      test(`reports HTTP ${status} without exposing the response body`, async () => {
        const client = createGoldApiClient({
          getApiKey: async () => 'test-key',
          fetch: async () => new Response('sensitive provider response', { status }),
        });
        await assert.rejects(client.getPrice('XAU'), (error: unknown) => {
          assert.ok(error instanceof GoldApiError);
          assert.equal(error.status, status);
          assert.equal(error.symbol, 'XAU');
          assert.equal(error.message, `Gold API XAU: HTTP ${status}`);
          return true;
        });
      });
    }

    test('wraps network and JSON failures', async () => {
      for (const fetch of [
        async () => {
          throw new TypeError('network unavailable');
        },
        async () => new Response('not JSON'),
      ]) {
        const client = createGoldApiClient({ getApiKey: async () => 'test-key', fetch });
        await assert.rejects(client.getPrice('XAU'), (error: unknown) => {
          assert.ok(error instanceof GoldApiError);
          assert.ok(error.cause instanceof Error);
          return true;
        });
      }
    });

    test('aborts slow requests, including response body reads', async () => {
      for (const duringBody of [false, true]) {
        const client = createGoldApiClient({
          getApiKey: async () => 'test-key',
          timeoutMs: 10,
          fetch: async (_input, init) => {
            const pending = () =>
              new Promise<never>((_resolve, reject) => {
                init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {
                  once: true,
                });
              });
            if (!duringBody) return pending();
            return Object.assign(new Response(), { json: pending });
          },
        });
        await assert.rejects(client.getPrice('XAU'), /request timed out/);
      }
    });

    test('rejects the batch when one metal fails', async () => {
      const client = createGoldApiClient({
        getApiKey: async () => 'test-key',
        fetch: async (input) => {
          const metal = String(input).split('/').at(-2);
          return metal === 'XAG'
            ? new Response('', { status: 503 })
            : Response.json({ ...payload, metal });
        },
      });
      await assert.rejects(client.getPrices(), { symbol: 'XAG', status: 503 });
    });
  });

  describe('credentials', () => {
    for (const key of ['', '   ', 'key\nother', 'key\rother']) {
      test(`rejects invalid key ${JSON.stringify(key)} before HTTP`, async () => {
        const fetch = mock.fn(async () => Response.json(payload));
        await assert.rejects(
          createGoldApiClient({ getApiKey: async () => key, fetch }).getPrice('XAU'),
          /Gold API key must be/,
        );
        assert.equal(fetch.mock.callCount(), 0);
      });
    }
    test('does not send HTTP requests when the key provider fails', async () => {
      const fetch = mock.fn(async () => Response.json(payload));
      const client = createGoldApiClient({
        getApiKey: async () => {
          throw new Error('secret unavailable');
        },
        fetch,
      });
      await assert.rejects(client.getPrice('XAU'), /secret unavailable/);
      assert.equal(fetch.mock.callCount(), 0);
    });
  });

  describe('configuration', () => {
    test('rejects invalid configuration before sending requests', () => {
      for (const timeoutMs of [0, -1, NaN, Infinity, 1.5, 2_147_483_648]) {
        assert.throws(
          () => createGoldApiClient({ getApiKey: async () => 'test-key', timeoutMs }),
          RangeError,
        );
      }
    });
  });
});
