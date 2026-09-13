import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import assert from 'node:assert/strict';
import { afterEach, describe, mock, test } from 'node:test';
import { handler } from '../src/handler.js';

describe('handler', () => {
  const originalArn = process.env.GOLD_API_SECRET_ARN;
  afterEach(() => {
    mock.restoreAll();
    if (originalArn === undefined) delete process.env.GOLD_API_SECRET_ARN;
    else process.env.GOLD_API_SECRET_ARN = originalArn;
  });

  test('validates configuration, then reuses secrets across warm invocations and refreshes after expiry', async () => {
    const send = mock.method(SecretsManagerClient.prototype, 'send', async () => ({
      SecretString: 'test-key',
    }));
    for (const value of [undefined, '', '  ', 'arn\nother']) {
      if (value === undefined) delete process.env.GOLD_API_SECRET_ARN;
      else process.env.GOLD_API_SECRET_ARN = value;
      await assert.rejects(handler(), /GOLD_API_SECRET_ARN must be/);
    }
    assert.equal(send.mock.callCount(), 0);
    process.env.GOLD_API_SECRET_ARN =
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:gold-abcdef';
    let now = 1_000_000;
    mock.method(Date, 'now', () => now);
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(new Headers(init?.headers).get('x-access-token'), 'test-key');
      return Response.json({
        metal: String(input).split('/').at(-2),
        currency: 'USD',
        price: 2345,
        timestamp: 1_700_000_000,
      });
    });
    assert.equal((await handler()).length, 3);
    now += 299_999;
    await handler();
    assert.equal(send.mock.callCount(), 1);
    now += 1;
    await handler();
    assert.equal(send.mock.callCount(), 2);
  });
});
