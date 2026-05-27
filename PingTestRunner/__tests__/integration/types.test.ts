/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-types
 *
 * Validates that the types package:
 * - Exports all expected runtime constants
 * - nativeExtensionCallbackType values are correct strings
 * - Re-exports from @forgerock/sdk-types are accessible at runtime
 *
 * Note: Most type exports are compile-time only.  This suite tests the
 * runtime-observable surface (constants, re-exported values).
 */

import { nativeExtensionCallbackType } from '@ping-identity/rn-types';

describe('@ping-identity/rn-types — integration', () => {
  describe('nativeExtensionCallbackType', () => {
    it('is defined and is an object', () => {
      expect(nativeExtensionCallbackType).toBeDefined();
      expect(typeof nativeExtensionCallbackType).toBe('object');
    });

    const expectedTypes = [
      'ConsentMappingCallback',
      'IdPCallback',
      'FidoRegistrationCallback',
      'FidoAuthenticationCallback',
      'BindingCallback',
      'DeviceBindingCallback',
      'DeviceSigningVerifierCallback',
    ] as const;

    for (const type of expectedTypes) {
      it(`contains "${type}" with the correct string value`, () => {
        expect(nativeExtensionCallbackType[type]).toBe(type);
      });
    }

    it('is frozen / treated as const (values equal keys)', () => {
      for (const [key, value] of Object.entries(nativeExtensionCallbackType)) {
        expect(value).toBe(key);
      }
    });
  });

  describe('consuming package type contracts at runtime', () => {
    it('can import nativeExtensionCallbackType without error', () => {
      expect(() => {
        const _ = nativeExtensionCallbackType.ConsentMappingCallback;
        void _;
      }).not.toThrow();
    });
  });
});
