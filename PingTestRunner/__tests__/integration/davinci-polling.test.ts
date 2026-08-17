/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-davinci POLLING / QR_CODE support
 *
 * Validates, against a mocked native module, that the bridge + JS wiring for
 * `pollStatus` works end-to-end for both polling modes described in
 * plan.md §5.1/§5.3:
 * - Simple polling: `subscriptionId` resolves before any tick is delivered,
 *   intermediate `continue` ticks stream through, and each terminal status
 *   (`complete`/`timedOut`/`expired`/`error`) stops delivery.
 * - Challenge-status polling: same contract, driven by a `PollingCollector`
 *   with `pollChallengeStatus: true`, using the `key` option to disambiguate
 *   when the node also carries a `QR_CODE` collector.
 * - `pollStatus` never calls `next()` internally on any status.
 * - The returned unsubscribe function stops local event delivery only;
 *   neither native SDK exposes a poll-cancellation primitive.
 */

export {};

type NativeDaVinciMock = {
  configureDaVinci: jest.Mock;
  start: jest.Mock;
  next: jest.Mock;
  getSession: jest.Mock;
  refresh: jest.Mock;
  revoke: jest.Mock;
  userinfo: jest.Mock;
  logout: jest.Mock;
  dispose: jest.Mock;
  pollDaVinci: jest.Mock;
};

type Listener = (event: Record<string, unknown>) => void;

/**
 * Minimal `DeviceEventEmitter` stand-in with real emit/remove semantics.
 *
 * @remarks
 * `davinci.ts`'s `pollStatus` calls `subscription.remove()` on itself from
 * inside the listener when a terminal status fires — a mock that only
 * captures the handler reference for direct invocation (as some other
 * integration suites in this file's siblings do) would bypass that
 * self-removal and let terminal-status tests pass for the wrong reason.
 * `emit` snapshots the listener array before iterating so a listener that
 * removes itself mid-emit doesn't skip a sibling listener.
 */
function createDeviceEventEmitter() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addListener: jest.fn((eventName: string, handler: Listener) => {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName)!.add(handler);
      return {
        remove: jest.fn(() => {
          listeners.get(eventName)?.delete(handler);
        }),
      };
    }),
    emit: (eventName: string, event: Record<string, unknown>) => {
      for (const handler of [...(listeners.get(eventName) ?? [])]) {
        handler(event);
      }
    },
  };
}

function makeMock(
  overrides: Partial<NativeDaVinciMock> = {},
): NativeDaVinciMock {
  return {
    configureDaVinci: jest.fn(async () => 'davinci-id-mock'),
    start: jest.fn(async () => ({
      type: 'ContinueNode',
      collectors: [
        {
          key: 'poll',
          type: 'POLLING',
          pollInterval: 2000,
          pollRetries: 60,
          pollChallengeStatus: false,
          challenge: '',
        },
      ],
    })),
    next: jest.fn(async () => ({
      type: 'SuccessNode',
      session: { value: 'session-token' },
    })),
    getSession: jest.fn(async () => ({ accessToken: 'mock-access-token' })),
    refresh: jest.fn(async () => ({ accessToken: 'mock-refreshed-token' })),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => ({ sub: 'user-mock' })),
    logout: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
    pollDaVinci: jest.fn(async () => ({ subscriptionId: 'sub-1' })),
    ...overrides,
  };
}

function mockReactNative(
  emitter: ReturnType<typeof createDeviceEventEmitter>,
): void {
  jest.doMock('react-native', () => ({
    Platform: {
      OS: 'ios',
      select: (s: Record<string, unknown>) => s.ios ?? s.default,
    },
    NativeModules: {},
    TurboModuleRegistry: {
      get: jest.fn(() => null),
      getEnforcing: jest.fn(() => null),
    },
    DeviceEventEmitter: emitter,
  }));
}

async function loadDaVinci(nativeMock: NativeDaVinciMock): Promise<{
  mod: ReturnType<typeof require>;
  emitter: ReturnType<typeof createDeviceEventEmitter>;
}> {
  jest.resetModules();
  const emitter = createDeviceEventEmitter();
  mockReactNative(emitter);
  jest.doMock('../../../packages/davinci/src/NativeRNPingDavinci', () => ({
    __esModule: true,
    default: nativeMock,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@ping-identity/rn-davinci');
  return { mod, emitter };
}

const POLLING_STATUS_EVENT = 'com.pingidentity.rndavinci.PollingStatus';

const VALID_CONFIG = {
  modules: {
    oidc: {
      discoveryEndpoint:
        'https://auth.example.com/.well-known/openid-configuration',
      clientId: 'davinci-client-id',
      redirectUri: 'org.forgerock.demo://oauth2redirect',
    },
  },
};

describe('@ping-identity/rn-davinci — polling integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('simple polling', () => {
    it('delivers a tick emitted before subscriptionId resolves, then streams continue ticks', async () => {
      const emitterRef: {
        current?: ReturnType<typeof createDeviceEventEmitter>;
      } = {};
      const mock = makeMock({
        pollDaVinci: jest.fn(async () => {
          // Simulate the native side emitting a status tick over the
          // DeviceEventEmitter channel before the pollDaVinci promise
          // resolves — the two channels are independent, so this ordering
          // is possible in production and must not drop the early event.
          emitterRef.current!.emit(POLLING_STATUS_EVENT, {
            subscriptionId: 'sub-1',
            status: 'continue',
            retryCount: 0,
            maxRetries: 60,
          });
          return { subscriptionId: 'sub-1' };
        }),
      });
      const loaded = await loadDaVinci(mock);
      const { mod, emitter } = loaded;
      emitterRef.current = emitter;
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      const onStatus = jest.fn();
      await client.pollStatus(onStatus);

      expect(mock.pollDaVinci).toHaveBeenCalledWith('davinci-id-mock', {});
      expect(onStatus).toHaveBeenNthCalledWith(1, {
        status: 'continue',
        retryCount: 0,
        maxRetries: 60,
      });

      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 1,
        maxRetries: 60,
      });
      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 2,
        maxRetries: 60,
      });

      expect(onStatus).toHaveBeenCalledTimes(3);
      expect(onStatus).toHaveBeenNthCalledWith(2, {
        status: 'continue',
        retryCount: 1,
        maxRetries: 60,
      });
    });

    it('stops delivering ticks after a complete status', async () => {
      const mock = makeMock();
      const { mod, emitter } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      const onStatus = jest.fn();
      await client.pollStatus(onStatus);

      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'complete',
        value: 'ok',
      });
      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 1,
        maxRetries: 60,
      });

      expect(onStatus).toHaveBeenCalledTimes(1);
      expect(onStatus).toHaveBeenCalledWith({
        status: 'complete',
        value: 'ok',
      });
    });

    it.each(['timedOut', 'expired', 'error'])(
      'stops delivering ticks after a %s status',
      async (status) => {
        const mock = makeMock();
        const { mod, emitter } = await loadDaVinci(mock);
        const client = mod.createDaVinciClient(VALID_CONFIG);
        await client.start();

        const onStatus = jest.fn();
        await client.pollStatus(onStatus);

        emitter.emit(
          POLLING_STATUS_EVENT,
          status === 'error'
            ? {
                subscriptionId: 'sub-1',
                status,
                error: { message: 'boom' },
              }
            : { subscriptionId: 'sub-1', status },
        );
        emitter.emit(POLLING_STATUS_EVENT, {
          subscriptionId: 'sub-1',
          status: 'continue',
          retryCount: 1,
          maxRetries: 60,
        });

        expect(onStatus).toHaveBeenCalledTimes(1);
      },
    );

    it('does not call next() internally on any terminal status', async () => {
      const mock = makeMock();
      const { mod, emitter } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      await client.pollStatus(jest.fn());
      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'complete',
        value: 'ok',
      });

      expect(mock.next).not.toHaveBeenCalled();
    });

    it('unsubscribe stops onStatus from firing on subsequent events (local listener removal only)', async () => {
      const mock = makeMock();
      const { mod, emitter } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      const onStatus = jest.fn();
      const unsubscribe = await client.pollStatus(onStatus);
      unsubscribe();

      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 1,
        maxRetries: 60,
      });

      expect(onStatus).not.toHaveBeenCalled();
    });
  });

  describe('challenge-status polling', () => {
    const challengeMock = () =>
      makeMock({
        start: jest.fn(async () => ({
          type: 'ContinueNode',
          collectors: [
            {
              key: 'qr',
              type: 'QR_CODE',
              content: 'data:image/png;base64,iVBORw0KGgo=',
              fallbackText: 'Scan this code',
            },
            {
              key: 'poll',
              type: 'POLLING',
              pollInterval: 1000,
              pollRetries: 30,
              pollChallengeStatus: true,
              challenge: 'challenge-abc',
            },
          ],
        })),
      });

    it('forwards the key option so the correct PollingCollector is resolved alongside a QR_CODE sibling', async () => {
      const mock = challengeMock();
      const { mod } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      await client.pollStatus(jest.fn(), { key: 'poll' });

      expect(mock.pollDaVinci).toHaveBeenCalledWith('davinci-id-mock', {
        key: 'poll',
      });
    });

    it('streams challenge-status ticks and terminates on expired', async () => {
      const mock = challengeMock();
      const { mod, emitter } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      const onStatus = jest.fn();
      await client.pollStatus(onStatus, { key: 'poll' });

      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 1,
        maxRetries: 30,
      });
      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'expired',
      });
      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'sub-1',
        status: 'continue',
        retryCount: 2,
        maxRetries: 30,
      });

      expect(onStatus).toHaveBeenCalledTimes(2);
      expect(onStatus).toHaveBeenLastCalledWith({
        status: 'expired',
      });
    });

    it('normalizeCollectors classifies both POLLING and QR_CODE as output_only', async () => {
      const mock = challengeMock();
      const { mod } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);

      expect(collectors[0]).toMatchObject({
        type: 'QR_CODE',
        executionMode: 'output_only',
        requiresUserInput: false,
      });
      expect(collectors[1]).toMatchObject({
        type: 'POLLING',
        executionMode: 'output_only',
        requiresUserInput: false,
      });
    });

    it('buildNextInput excludes POLLING and QR_CODE from the submitted payload', async () => {
      const mock = challengeMock();
      const { mod } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();

      const plan = mod.buildNextInput(node, {});
      expect(plan.input.collectors).toEqual([]);
    });
  });

  describe('failure paths', () => {
    it('propagates a native pollDaVinci rejection as DaVinciError', async () => {
      const mock = makeMock({
        pollDaVinci: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_POLL_ERROR',
            message: 'no active PollingCollector',
          };
        }),
      });
      const { mod } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      await expect(client.pollStatus(jest.fn())).rejects.toMatchObject({
        name: 'DaVinciError',
        code: 'DAVINCI_POLL_ERROR',
      });
    });

    it('events tagged with an unrelated subscriptionId are ignored', async () => {
      const mock = makeMock();
      const { mod, emitter } = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();

      const onStatus = jest.fn();
      await client.pollStatus(onStatus);

      emitter.emit(POLLING_STATUS_EVENT, {
        subscriptionId: 'unrelated-subscription',
        status: 'continue',
        retryCount: 1,
        maxRetries: 60,
      });

      expect(onStatus).not.toHaveBeenCalled();
    });
  });
});
