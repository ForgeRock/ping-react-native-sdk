/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { PingError } from '../index';

describe('PingError', () => {
  it('is instanceof Error and instanceof PingError', () => {
    const err = new PingError('test message', 'TEST_CODE', 'test_type');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PingError);
  });

  it('sets name to PingError', () => {
    const err = new PingError('msg', 'CODE', 'type');
    expect(err.name).toBe('PingError');
  });

  it('sets message, code, and type', () => {
    const err = new PingError('the message', 'MY_CODE', 'my_type');
    expect(err.message).toBe('the message');
    expect(err.code).toBe('MY_CODE');
    expect(err.type).toBe('my_type');
  });

  it('sets status when provided', () => {
    const err = new PingError('msg', 'CODE', 'type', 401);
    expect(err.status).toBe(401);
  });

  it('leaves status undefined when not provided', () => {
    const err = new PingError('msg', 'CODE', 'type');
    expect(err.status).toBeUndefined();
  });

  describe('PingError.from', () => {
    it('returns the same instance when given a PingError', () => {
      const original = new PingError('msg', 'CODE', 'type');
      expect(PingError.from(original)).toBe(original);
    });

    it('maps GenericError-shaped plain object fields correctly', () => {
      const raw = {
        error: 'FIDO_WINDOW_UNAVAILABLE',
        type: 'fido_error',
        message: 'window unavailable',
      };
      const err = PingError.from(raw);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PingError);
      expect(err.code).toBe('FIDO_WINDOW_UNAVAILABLE');
      expect(err.type).toBe('fido_error');
      expect(err.message).toBe('window unavailable');
    });

    it('populates status when the raw object has a numeric status', () => {
      const raw = {
        error: 'OIDC_TOKEN_ERROR',
        type: 'network_error',
        message: 'token request failed',
        status: 401,
      };
      const err = PingError.from(raw);
      expect(err.status).toBe(401);
    });

    it('uses error field as message when message is absent', () => {
      const raw = { error: 'BINDING_ERROR', type: 'auth_error' };
      const err = PingError.from(raw);
      expect(err.message).toBe('BINDING_ERROR');
    });

    it('falls back to UNKNOWN_ERROR code when error field is absent', () => {
      const raw = { type: 'unknown_error', message: 'something went wrong' };
      const err = PingError.from(raw);
      expect(err.code).toBe('UNKNOWN_ERROR');
    });

    it('reads code from r.code when error and userInfo.error are absent (iOS bridge shape)', () => {
      const raw = {
        code: 'BINDING_SIGN_ERROR',
        domain: 'PingBinding.DeviceBindingStatus',
        nativeStackIOS: [],
        userInfo: {},
      };
      const err = PingError.from(raw);
      expect(err.code).toBe('BINDING_SIGN_ERROR');
    });

    it('reads error/type/message from userInfo when top-level fields are absent (Android bridge shape)', () => {
      const raw = {
        name: 'com.pingidentity.device.binding.authenticator.exception.AbortException',
        code: 'BINDING_CANCELLED',
        nativeStackAndroid: [],
        userInfo: {
          message: 'User cancelled the operation',
          error: 'BINDING_CANCELLED',
          type: 'internal_error',
        },
      };
      const err = PingError.from(raw);
      expect(err.code).toBe('BINDING_CANCELLED');
      expect(err.type).toBe('internal_error');
      expect(err.message).toBe('User cancelled the operation');
    });

    it('prefers top-level fields over userInfo when both are present', () => {
      const raw = {
        error: 'TOP_LEVEL_CODE',
        type: 'top_level_type',
        message: 'top level message',
        userInfo: {
          error: 'USERINFO_CODE',
          type: 'userinfo_type',
          message: 'userinfo message',
        },
      };
      const err = PingError.from(raw);
      expect(err.code).toBe('TOP_LEVEL_CODE');
      expect(err.type).toBe('top_level_type');
      expect(err.message).toBe('top level message');
    });

    it('wraps a plain Error preserving its message', () => {
      const original = new Error('FIDO_REGISTER_ERROR');
      const err = PingError.from(original);
      expect(err).toBeInstanceOf(PingError);
      expect(err.message).toBe('FIDO_REGISTER_ERROR');
    });

    it('preserves the native stack when wrapping a plain Error', () => {
      const original = new Error('boom');
      const err = PingError.from(original);
      expect(err.stack).toBe(original.stack);
    });

    it('does not set status when the raw object has a non-numeric status', () => {
      const raw = {
        error: 'OIDC_ERROR',
        type: 'network_error',
        status: '401',
      };
      const err = PingError.from(raw);
      expect(err.status).toBeUndefined();
    });
  });

  describe('PingError.fromAs', () => {
    class TestError extends PingError {
      constructor(m: string, c: string, t: string, s?: number) {
        super(m, c, t, s);
        this.name = 'TestError';
        Object.setPrototypeOf(this, new.target.prototype);
      }
    }

    it('returns the same instance when already the target subclass', () => {
      const original = new TestError('msg', 'CODE', 'type');
      expect(PingError.fromAs(original, TestError)).toBe(original);
    });

    it('wraps a plain object into the target subclass', () => {
      const raw = {
        error: 'TEST_CODE',
        type: 'test_type',
        message: 'test msg',
      };
      const err = PingError.fromAs(raw, TestError);
      expect(err).toBeInstanceOf(TestError);
      expect(err).toBeInstanceOf(PingError);
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('test msg');
    });

    it('preserves the stack when wrapping a plain Error', () => {
      const original = new Error('boom');
      const err = PingError.fromAs(original, TestError);
      expect(err).toBeInstanceOf(TestError);
      expect(err.stack).toBe(original.stack);
    });

    it('does not re-wrap a PingError base instance as a subclass', () => {
      const base = new PingError('msg', 'CODE', 'type');
      const err = PingError.fromAs(base, TestError);
      expect(err).toBeInstanceOf(TestError);
      expect(err.code).toBe('CODE');
    });
  });
});
