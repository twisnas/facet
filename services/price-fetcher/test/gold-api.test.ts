import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { createGoldApiClient, GoldApiError, METAL_SYMBOLS } from '../src/gold-api.js';

describe('createGoldApiClient', () => {
  const originalSecretArn = process.env.GOLD_API_SECRET_ARN;
  beforeEach(() => {
    process.env.GOLD_API_SECRET_ARN =
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:gold-api-test';
    mock.method(SecretsManagerClient.prototype, 'send', async () => ({ SecretString: 'test-key' }));
  });
  afterEach(() => {
    mock.restoreAll();
    if (originalSecretArn === undefined) delete process.env.GOLD_API_SECRET_ARN;
    else process.env.GOLD_API_SECRET_ARN = originalSecretArn;
  });

  const payload = { metal: 'XAU', currency: 'USD', price: 2345.1234, timestamp: 1_700_000_000 };
  const clientWith = (body: unknown) =>
    createGoldApiClient({
      fetch: async () => Response.json(body),
    });

  describe('requests and normalization', () => {
    test('requests all metals with authentication and normalizes without rounding', async () => {
      const urls: string[] = [];
      const client = createGoldApiClient({
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
        const client = createGoldApiClient({ fetch });
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

  describe('secret retrieval', () => {
    test('loads AWSCURRENT once for all metals without exposing the key in results', async () => {
      mock.restoreAll();
      const send = mock.method(
        SecretsManagerClient.prototype,
        'send',
        async (command: GetSecretValueCommand) => {
          assert.ok(command instanceof GetSecretValueCommand);
          assert.deepEqual(command.input, {
            SecretId: process.env.GOLD_API_SECRET_ARN,
            VersionStage: 'AWSCURRENT',
          });
          return { SecretString: '  test-key  ' };
        },
      );
      const client = createGoldApiClient({
        fetch: async (input, init) => {
          assert.equal(new Headers(init?.headers).get('x-access-token'), 'test-key');
          return Response.json({ ...payload, metal: String(input).split('/').at(-2) });
        },
      });
      const prices = await client.getPrices();
      assert.equal(send.mock.callCount(), 1);
      assert.equal(JSON.stringify(prices).includes('test-key'), false);
    });

    for (const value of [undefined, '', '   ', 'key\nother', 'key\rother']) {
      test(`rejects missing or invalid secret string ${JSON.stringify(value)}`, async () => {
        mock.restoreAll();
        mock.method(SecretsManagerClient.prototype, 'send', async () => ({ SecretString: value }));
        const fetch = mock.fn(async () => Response.json(payload));
        await assert.rejects(
          createGoldApiClient({ fetch }).getPrice('XAU'),
          /Unable to load Gold API key/,
        );
        assert.equal(fetch.mock.callCount(), 0);
      });
    }

    for (const name of ['ResourceNotFoundException', 'AccessDeniedException', 'TimeoutError']) {
      test(`handles ${name} without leaking SDK details and retries on the next call`, async () => {
        mock.restoreAll();
        let calls = 0;
        mock.method(SecretsManagerClient.prototype, 'send', async () => {
          if (++calls === 1) throw Object.assign(new Error('sensitive SDK details'), { name });
          return { SecretString: 'test-key' };
        });
        const fetch = mock.fn(async () => Response.json(payload));
        const client = createGoldApiClient({ fetch });
        await assert.rejects(client.getPrice('XAU'), (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Unable to load Gold API key/);
          assert.equal(error.message.includes('sensitive'), false);
          assert.equal(error.cause, undefined);
          return true;
        });
        assert.equal(fetch.mock.callCount(), 0);
        await client.getPrice('XAU');
        assert.equal(calls, 2);
      });
    }

    test('new clients pick up rotated secret values', async () => {
      mock.restoreAll();
      let version = 0;
      mock.method(SecretsManagerClient.prototype, 'send', async () => ({
        SecretString: `key-${++version}`,
      }));
      const tokens: (string | null)[] = [];
      const fetch: typeof globalThis.fetch = async (_input, init) => {
        tokens.push(new Headers(init?.headers).get('x-access-token'));
        return Response.json(payload);
      };
      await createGoldApiClient({ fetch }).getPrice('XAU');
      await createGoldApiClient({ fetch }).getPrice('XAU');
      assert.deepEqual(tokens, ['key-1', 'key-2']);
    });
  });

  describe('configuration', () => {
    test('rejects invalid configuration before sending requests', () => {
      for (const apiKey of [undefined, '', '  ', 'key\nother', 'key\rother']) {
        if (apiKey === undefined) delete process.env.GOLD_API_SECRET_ARN;
        else process.env.GOLD_API_SECRET_ARN = apiKey;
        assert.throws(() => createGoldApiClient(), /GOLD_API_SECRET_ARN must be/);
      }
      process.env.GOLD_API_SECRET_ARN = 'test-key';
      for (const timeoutMs of [0, -1, NaN, Infinity, 1.5, 2_147_483_648]) {
        assert.throws(() => createGoldApiClient({ timeoutMs }), RangeError);
      }
    });
  });
});
