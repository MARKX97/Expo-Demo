import { describe, expect, it } from '@jest/globals';

import { createUuid } from '@/lib/uuid';

describe('createUuid', () => {
  it('creates an RFC 4122 v4 UUID without relying on a global crypto polyfill', () => {
    const originalCrypto = globalThis.crypto;

    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    const id = createUuid();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
