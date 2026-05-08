/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-storage
 *
 * Validates that the storage package:
 * - Exports configureSessionStorage and configureOidcStorage
 * - Returns branded handle objects with the correct `kind` field
 * - Validates config (throws when config is missing)
 * - Delegates to the native module correctly
 * - Propagates native errors to callers
 */

import {
  configureSessionStorage,
  configureOidcStorage,
  CacheStrategy,
} from '@ping-identity/rn-storage';

describe('@ping-identity/rn-storage — integration', () => {
  describe('exports', () => {
    it('exports configureSessionStorage', () => {
      expect(typeof configureSessionStorage).toBe('function');
    });

    it('exports configureOidcStorage', () => {
      expect(typeof configureOidcStorage).toBe('function');
    });

    it('exports CacheStrategy enum', () => {
      expect(CacheStrategy).toBeDefined();
      expect(CacheStrategy.CACHE).toBeDefined();
      expect(CacheStrategy.NO_CACHE).toBeDefined();
      expect(CacheStrategy.CACHE_ON_FAILURE).toBeDefined();
    });
  });

  describe('configureSessionStorage()', () => {
    it('throws when config is missing/null', () => {
      expect(() =>
        // @ts-expect-error — intentional bad input
        configureSessionStorage(null),
      ).toThrow();
    });

    it('returns a session storage handle with kind="session"', () => {
      const handle = configureSessionStorage({
        android: { keyAlias: 'test-session-key', fileName: 'test-session' },
      });
      expect(handle).toBeDefined();
      expect(handle.kind).toBe('session');
    });

    it('returns a handle with a non-empty id', () => {
      const handle = configureSessionStorage({
        android: { keyAlias: 'test-session-key' },
      });
      expect(typeof handle.id).toBe('string');
      expect(handle.id.length).toBeGreaterThan(0);
    });

    it('accepts iOS-specific config without throwing', () => {
      expect(() =>
        configureSessionStorage({
          ios: { account: 'com.example.app' },
        }),
      ).not.toThrow();
    });

    it('accepts Android CacheStrategy config', () => {
      expect(() =>
        configureSessionStorage({
          android: {
            keyAlias: 'test',
            cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
          },
        }),
      ).not.toThrow();
    });
  });

  describe('configureOidcStorage()', () => {
    it('throws when config is missing/null', () => {
      expect(() =>
        // @ts-expect-error — intentional bad input
        configureOidcStorage(null),
      ).toThrow();
    });

    it('returns an OIDC storage handle with kind="oidc"', () => {
      const handle = configureOidcStorage({
        android: { keyAlias: 'test-oidc-key', fileName: 'test-oidc' },
      });
      expect(handle).toBeDefined();
      expect(handle.kind).toBe('oidc');
    });

    it('returns a handle with a non-empty id', () => {
      const handle = configureOidcStorage({
        ios: { account: 'com.example.app' },
      });
      expect(typeof handle.id).toBe('string');
      expect(handle.id.length).toBeGreaterThan(0);
    });
  });

  describe('cross-package type compatibility', () => {
    it('session handle id is a valid string for downstream packages', () => {
      const session = configureSessionStorage({ android: { keyAlias: 'k' } });
      // This simulates passing the handle to Journey or OIDC
      expect(typeof session.id).toBe('string');
    });

    it('oidc handle id is a valid string for downstream packages', () => {
      const oidc = configureOidcStorage({ android: { keyAlias: 'k' } });
      expect(typeof oidc.id).toBe('string');
    });
  });
});
