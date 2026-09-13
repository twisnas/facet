import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Each reader owns its cache; entries are isolated by ARN.
export function createSecretReader() {
  const cache = new Map<string, { value: Promise<string>; expiresAt: number }>();

  return async function getSecretString(secretArn: string): Promise<string> {
    const arn = secretArn.trim();
    if (!arn || /[\r\n]/.test(arn)) {
      throw new TypeError('Secret ARN must be non-empty and contain no newlines');
    }
    const cached = cache.get(arn);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const entry = { value: Promise.resolve(''), expiresAt: Infinity };
    entry.value = Promise.resolve().then(async () => {
      const client = new SecretsManagerClient({ maxAttempts: 2 });
      try {
        const result = await client.send(
          new GetSecretValueCommand({ SecretId: arn, VersionStage: 'AWSCURRENT' }),
          { abortSignal: AbortSignal.timeout(5_000) },
        );
        if (typeof result.SecretString !== 'string' || !result.SecretString.length) {
          throw new Error('missing secret string');
        }
        entry.expiresAt = Date.now() + 5 * 60_000;
        return result.SecretString;
      } catch {
        cache.delete(arn);
        // Never include secret contents or SDK error details in logs.
        throw new Error(
          'Unable to load secret string from Secrets Manager; verify the value and access',
        );
      } finally {
        client.destroy();
      }
    });
    cache.set(arn, entry);
    return entry.value;
  };
}

// Shared runtime reader retains successful secrets across warm invocations.
export const getSecretString = createSecretReader();
