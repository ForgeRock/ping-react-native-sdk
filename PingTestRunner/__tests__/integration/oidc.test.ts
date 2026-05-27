/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-oidc
 *
 * Validates that the oidc package:
 * - Exports createOidcClient, createOidcWebClient, and hooks
 * - Throws when required config is missing
 * - Returns typed client handles with expected method surfaces
 * - Delegates token/refresh/userinfo/revoke to native
 * - createOidcWebClient requires a valid OidcClient handle (not a raw OIDC storage handle)
 * - Sanitizes tokenExpiry out of token responses
 */

import { createOidcClient, createOidcWebClient } from '@ping-identity/rn-oidc';

const VALID_CONFIG = {
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  clientId: 'test-client',
  redirectUri: 'org.forgerock.demo://oauth2redirect',
  scopes: ['openid', 'profile'],
};

describe('@ping-identity/rn-oidc — integration', () => {
  describe('exports', () => {
    it('exports createOidcClient', () => {
      expect(typeof createOidcClient).toBe('function');
    });

    it('exports createOidcWebClient', () => {
      expect(typeof createOidcWebClient).toBe('function');
    });
  });

  describe('createOidcClient()', () => {
    it('throws when discoveryEndpoint and openId are both missing', () => {
      expect(() =>
        createOidcClient({ clientId: 'c', redirectUri: 'r' } as Parameters<
          typeof createOidcClient
        >[0]),
      ).toThrow(
        '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.',
      );
    });

    it('returns a client handle when discoveryEndpoint is provided', () => {
      const client = createOidcClient(VALID_CONFIG);
      expect(client).toBeDefined();
      expect(typeof client.id).toBe('string');
      expect(client.id.length).toBeGreaterThan(0);
    });

    it('returned client has the correct method surface', () => {
      const client = createOidcClient(VALID_CONFIG);
      const methods = ['token', 'refresh', 'userinfo', 'revoke', 'endSession'];
      for (const m of methods) {
        expect(typeof (client as Record<string, unknown>)[m]).toBe('function');
      }
    });

    it('client.token() returns tokens without tokenExpiry', async () => {
      const client = createOidcClient(VALID_CONFIG);
      const tokens = await client.token();
      expect(tokens).toBeDefined();
      expect((tokens as Record<string, unknown>).tokenExpiry).toBeUndefined();
      expect(tokens.accessToken).toBe('mock-access-token');
    });

    it('client.refresh() returns refreshed tokens without tokenExpiry', async () => {
      const client = createOidcClient(VALID_CONFIG);
      const tokens = await client.refresh();
      expect((tokens as Record<string, unknown>).tokenExpiry).toBeUndefined();
      expect(tokens.accessToken).toBe('mock-refreshed-access-token');
    });

    it('client.userinfo() returns user info object', async () => {
      const client = createOidcClient(VALID_CONFIG);
      const info = await client.userinfo();
      expect(info).toBeDefined();
      expect((info as Record<string, unknown>).sub).toBe('user-mock');
    });

    it('client.revoke() resolves without throwing', async () => {
      const client = createOidcClient(VALID_CONFIG);
      await expect(client.revoke()).resolves.not.toThrow();
    });

    it('client.endSession() resolves without throwing', async () => {
      const client = createOidcClient(VALID_CONFIG);
      await expect(client.endSession()).resolves.not.toThrow();
    });
  });

  describe('createOidcWebClient()', () => {
    it('returns a web client handle with expected methods', () => {
      const client = createOidcClient(VALID_CONFIG);
      const webClient = createOidcWebClient(client);
      expect(typeof webClient.id).toBe('string');
      expect(typeof webClient.authorize).toBe('function');
      expect(typeof webClient.user).toBe('function');
    });

    it('webClient.authorize() returns an auth result', async () => {
      const client = createOidcClient(VALID_CONFIG);
      const webClient = createOidcWebClient(client);
      const result = await webClient.authorize();
      expect(result).toBeDefined();
      expect((result as Record<string, unknown>).code).toBe('auth-code-mock');
    });

    it('webClient.user() returns a user object when hasUser=true', async () => {
      const client = createOidcClient(VALID_CONFIG);
      const webClient = createOidcWebClient(client);
      const user = await webClient.user();
      expect(user).not.toBeNull();
    });

    it('webClient.user() returns null when hasUser=false', async () => {
      jest.resetModules();
      // Override hasUser to return false for this test
      jest.doMock('../../../packages/oidc/src/NativeRNPingOidc', () => ({
        __esModule: true,
        getNativeModule: jest.fn(() => ({
          createClient: jest.fn(() => 'oidc-client-id-mock'),
          createWebClient: jest.fn(() => 'oidc-web-client-id-mock'),
          clientToken: jest.fn(async () => ({ accessToken: 'mock' })),
          clientRefresh: jest.fn(async () => ({ accessToken: 'mock' })),
          clientUserinfo: jest.fn(async () => ({ sub: 'user-mock' })),
          clientRevoke: jest.fn(async () => undefined),
          clientEndSession: jest.fn(async () => undefined),
          authorize: jest.fn(async () => ({ code: 'auth-code-mock' })),
          hasUser: jest.fn(async () => false),
          token: jest.fn(async () => ({ accessToken: 'mock' })),
          refresh: jest.fn(async () => ({ accessToken: 'mock' })),
          userinfo: jest.fn(async () => ({ sub: 'web-user-mock' })),
          revoke: jest.fn(async () => undefined),
          logout: jest.fn(async () => undefined),
        })),
      }));

      const {
        createOidcClient: c,
        createOidcWebClient: wc,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require('@ping-identity/rn-oidc');
      const testClient = c(VALID_CONFIG);
      const testWebClient = wc(testClient);
      const user = await testWebClient.user();
      expect(user).toBeNull();
    });
  });

  describe('storage handle validation', () => {
    it('throws when an invalid storage object is passed', () => {
      expect(() =>
        createOidcClient({
          ...VALID_CONFIG,
          // @ts-expect-error — intentional bad input
          storage: { id: '', kind: 'session' },
        }),
      ).toThrow('[@ping-identity/rn-oidc] Invalid storage handle');
    });

    it('throws when storage kind is not "oidc"', () => {
      expect(() =>
        createOidcClient({
          ...VALID_CONFIG,
          // @ts-expect-error — intentional bad input
          storage: { id: 'some-id', kind: 'session' },
        }),
      ).toThrow('[@ping-identity/rn-oidc] Invalid storage handle');
    });
  });
});
