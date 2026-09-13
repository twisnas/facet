import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import assert from 'node:assert/strict';
import { afterEach, describe, mock, test } from 'node:test';
import { createSecretReader } from '../src/utils/secrets.js';

const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:example-abcdef';

describe('getSecretString', () => {
  afterEach(() => mock.restoreAll());

  test('retrieves AWSCURRENT and preserves arbitrary string data', async () => {
    const value = ' {\n  "password": "example"\n}\n';
    const send = mock.method(
      SecretsManagerClient.prototype,
      'send',
      async (command: GetSecretValueCommand) => {
        assert.ok(command instanceof GetSecretValueCommand);
        assert.deepEqual(command.input, { SecretId: arn, VersionStage: 'AWSCURRENT' });
        return { SecretString: value };
      },
    );
    const read = createSecretReader();
    assert.deepEqual(await Promise.all([read(arn), read(arn), read(arn)]), [value, value, value]);
    assert.equal(send.mock.callCount(), 1);
  });

  test('isolates cached values by ARN', async () => {
    const send = mock.method(
      SecretsManagerClient.prototype,
      'send',
      async (command: GetSecretValueCommand) => ({ SecretString: command.input.SecretId }),
    );
    const read = createSecretReader();
    assert.equal(await read(arn), arn);
    assert.equal(await read(`${arn}-other`), `${arn}-other`);
    assert.equal(await read(arn), arn);
    assert.equal(send.mock.callCount(), 2);
  });

  test('rejects invalid ARNs before calling AWS', async () => {
    const send = mock.method(SecretsManagerClient.prototype, 'send');
    for (const value of ['', '  ', 'arn\nother', 'arn\rother']) {
      await assert.rejects(createSecretReader()(value), /Secret ARN must be/);
    }
    assert.equal(send.mock.callCount(), 0);
  });

  for (const result of [{}, { SecretString: '' }, { SecretBinary: new Uint8Array([1]) }]) {
    test(`rejects missing string data ${JSON.stringify(result)}`, async () => {
      mock.method(SecretsManagerClient.prototype, 'send', async () => result);
      await assert.rejects(createSecretReader()(arn), /Unable to load secret string/);
    });
  }

  for (const name of ['ResourceNotFoundException', 'AccessDeniedException', 'TimeoutError']) {
    test(`sanitizes ${name} and permits retry`, async () => {
      let calls = 0;
      mock.method(SecretsManagerClient.prototype, 'send', async () => {
        if (++calls === 1) throw Object.assign(new Error('sensitive details'), { name });
        return { SecretString: 'recovered' };
      });
      const read = createSecretReader();
      await assert.rejects(read(arn), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Unable to load secret string/);
        assert.equal(error.message.includes('sensitive'), false);
        assert.equal(error.cause, undefined);
        return true;
      });
      assert.equal(await read(arn), 'recovered');
    });
  }

  test('refreshes after five minutes and never serves an expired value on failure', async () => {
    let now = 1_000_000;
    mock.method(Date, 'now', () => now);
    let reads = 0;
    mock.method(SecretsManagerClient.prototype, 'send', async () => {
      if (++reads === 2) throw new Error('unavailable');
      return { SecretString: `value-${reads}` };
    });
    const read = createSecretReader();
    assert.equal(await read(arn), 'value-1');
    now += 299_999;
    assert.equal(await read(arn), 'value-1');
    now += 1;
    await assert.rejects(read(arn), /Unable to load secret string/);
    assert.equal(await read(arn), 'value-3');
  });
});
