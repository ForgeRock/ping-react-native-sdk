/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-core
 *
 * The core package provides the native bridge foundation shared by all other
 * packages.  Because it has no JS-level public API of its own, these tests
 * validate:
 * - The package is resolvable (does not throw on import)
 * - Any runtime exports that exist satisfy their expected shape
 * - Downstream packages that depend on core resolve without error when core
 *   is loaded
 */

/* eslint-disable @typescript-eslint/no-require-imports */
describe('@ping-identity/rn-core — integration', () => {
  describe('resolvability', () => {
    it('can be required without throwing', () => {
      expect(() => {
        require('@ping-identity/rn-core');
      }).not.toThrow();
    });

    it('resolves to an object', () => {
      const core = require('@ping-identity/rn-core');
      expect(typeof core).toBe('object');
    });
  });

  describe('downstream package wiring', () => {
    it('rn-logger resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-logger')).not.toThrow();
    });

    it('rn-browser resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-browser')).not.toThrow();
    });

    it('rn-oidc resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-oidc')).not.toThrow();
    });

    it('rn-journey resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-journey')).not.toThrow();
    });

    it('rn-storage resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-storage')).not.toThrow();
    });

    it('rn-device-id resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-device-id')).not.toThrow();
    });

    it('rn-device-profile resolves with rn-core present', () => {
      expect(() => require('@ping-identity/rn-device-profile')).not.toThrow();
    });
  });
});
/* eslint-enable @typescript-eslint/no-require-imports */
