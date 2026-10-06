/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { PingError } from '@ping-identity/rn-types';
import { FidoError } from '../types';

describe('FidoError.from', () => {
  it('reads clientError from the native rejection userInfo', () => {
    const err = FidoError.from({
      error: 'FIDO_AUTHENTICATE_ERROR',
      type: 'fido_error',
      message: 'm',
      userInfo: { clientError: 'TimeoutError' },
    });

    expect(err).toBeInstanceOf(FidoError);
    expect(err).toBeInstanceOf(PingError);
    expect(err.name).toBe('FidoError');
    expect(err.code).toBe('FIDO_AUTHENTICATE_ERROR');
    expect(err.type).toBe('fido_error');
    expect(err.message).toBe('m');
    expect(err.clientError).toBe('TimeoutError');
  });

  it.each([
    'NotAllowedError',
    'TimeoutError',
    'NotSupportedError',
    'InvalidStateError',
    'UnknownError',
  ])('exposes the known client error name %s', (clientError) => {
    const err = FidoError.from({
      error: 'FIDO_REGISTER_ERROR',
      type: 'fido_error',
      message: 'register failed',
      userInfo: { clientError },
    });

    expect(err.clientError).toBe(clientError);
  });

  it('passes through unknown WebAuthn DOMException names from the open Android set', () => {
    const err = FidoError.from({
      error: 'FIDO_AUTHENTICATE_ERROR',
      type: 'fido_error',
      message: 'm',
      userInfo: { clientError: 'SecurityError' },
    });

    expect(err.clientError).toBe('SecurityError');
  });

  it.each([
    [
      'no userInfo',
      { error: 'FIDO_REGISTER_ERROR', type: 'fido_error', message: 'm' },
    ],
    [
      'null userInfo',
      {
        error: 'FIDO_REGISTER_ERROR',
        type: 'fido_error',
        message: 'm',
        userInfo: null,
      },
    ],
    [
      'a non-string clientError',
      {
        error: 'FIDO_REGISTER_ERROR',
        type: 'fido_error',
        message: 'm',
        userInfo: { clientError: 42 },
      },
    ],
    [
      'an empty clientError',
      {
        error: 'FIDO_REGISTER_ERROR',
        type: 'fido_error',
        message: 'm',
        userInfo: { clientError: '' },
      },
    ],
    [
      'a whitespace-only clientError',
      {
        error: 'FIDO_REGISTER_ERROR',
        type: 'fido_error',
        message: 'm',
        userInfo: { clientError: '   ' },
      },
    ],
  ])(
    'leaves clientError undefined for a rejection carrying %s',
    (_label, nativeError) => {
      const err = FidoError.from(nativeError);

      expect(err.clientError).toBeUndefined();
    },
  );

  it('returns the same instance when the value is already a FidoError', () => {
    const existing = new FidoError(
      'm',
      'FIDO_REGISTER_ERROR',
      'fido_error',
      undefined,
      'NotAllowedError',
    );

    expect(FidoError.from(existing)).toBe(existing);
  });
});
