/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';

const mockNativeDaVinci = {
  configureDaVinci: jest.fn(async () => 'davinci-id-1'),
  start: jest.fn(async () => ({ type: 'ContinueNode', collectors: [] })),
  next: jest.fn(),
  getSession: jest.fn(async () => null),
  refresh: jest.fn(async () => null),
  revoke: jest.fn(async () => true),
  userinfo: jest.fn(async () => null),
  logout: jest.fn(async () => undefined),
  dispose: jest.fn(async () => undefined),
};

jest.mock('../NativeRNPingDavinci', () => ({
  __esModule: true,
  default: mockNativeDaVinci,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DaVinciProvider, useDaVinci } = require('../useDavinci');
type DaVinciHookResult = import('../useDavinci').DaVinciHookResult;
type DaVinciNode = import('../types').DaVinciNode;

type HarnessProps = {
  onResult: (result: DaVinciHookResult) => void;
};

/**
 * Returns non-null hook result for assertions.
 *
 * @param result - Nullable hook result.
 * @returns Non-null hook result.
 * @throws {Error} When result is null.
 */
function requireLatest(result: DaVinciHookResult | null): DaVinciHookResult {
  if (!result) {
    throw new Error('Expected hook result to be available.');
  }
  return result;
}

/**
 * Hook harness that consumes DaVinci context.
 *
 * @param props - Harness props.
 * @returns Null render output.
 */
function ContextHarness(props: HarnessProps): React.ReactElement | null {
  const { onResult } = props;
  const davinci = useDaVinci() as DaVinciHookResult;

  useEffect(() => {
    onResult(davinci);
  }, [davinci, onResult]);

  return null;
}

const VALID_CONFIG = {
  modules: {
    oidc: {
      discoveryEndpoint:
        'https://auth.example.com/.well-known/openid-configuration',
      clientId: 'my-client',
      redirectUri: 'app://callback',
    },
  },
};

const continueNode: DaVinciNode = {
  type: 'ContinueNode',
  collectors: [],
};

describe('useDaVinci provider', () => {
  beforeEach(() => {
    mockNativeDaVinci.configureDaVinci.mockClear();
    mockNativeDaVinci.start.mockClear();
    mockNativeDaVinci.start.mockResolvedValue(continueNode);
  });

  it('throws when useDaVinci is used without a client or provider', () => {
    function MissingProviderHarness(): React.ReactElement | null {
      useDaVinci();
      return null;
    }

    expect(() => {
      render(<MissingProviderHarness />);
    }).toThrow('No DaVinci client found');
  });

  it('uses provider-created client when hook is consumed without a direct client', async () => {
    let latest: DaVinciHookResult | null = null;
    render(
      <DaVinciProvider config={VALID_CONFIG}>
        <ContextHarness
          onResult={(r) => {
            latest = r;
          }}
        />
      </DaVinciProvider>,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    expect(requireLatest(latest).node).toEqual(continueNode);
    expect(mockNativeDaVinci.configureDaVinci).toHaveBeenCalledTimes(1);
  });

  it('shares DaVinci state across multiple consumers under the same provider', async () => {
    let resultA: DaVinciHookResult | null = null;
    let resultB: DaVinciHookResult | null = null;

    render(
      <DaVinciProvider config={VALID_CONFIG}>
        <ContextHarness
          onResult={(r) => {
            resultA = r;
          }}
        />
        <ContextHarness
          onResult={(r) => {
            resultB = r;
          }}
        />
      </DaVinciProvider>,
    );

    await act(async () => {
      await requireLatest(resultA).start();
    });

    expect(requireLatest(resultA).node).toEqual(continueNode);
    expect(requireLatest(resultB).node).toEqual(continueNode);
    // start() should only have been called once (shared state, not once per consumer).
    expect(mockNativeDaVinci.start).toHaveBeenCalledTimes(1);
  });
});

describe('native module resolution', () => {
  it('throws clear error when the native module is unavailable', () => {
    jest.isolateModules(() => {
      jest.unmock('../NativeRNPingDavinci');
      jest.doMock('react-native', () => ({
        NativeModules: {},
        TurboModuleRegistry: { get: jest.fn() },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeModule = require('../NativeRNPingDavinci');
      expect(() => nativeModule.getNativeModule()).toThrow(
        '[@ping-identity/rn-davinci] Native module RNPingDavinci not found.',
      );
    });
  });

  it('falls back to classic module when TurboModule is missing', () => {
    jest.isolateModules(() => {
      jest.unmock('../NativeRNPingDavinci');
      const classic = {};
      jest.doMock('react-native', () => ({
        NativeModules: { RNPingDavinciClassic: classic },
        TurboModuleRegistry: {
          get: jest.fn(() => undefined),
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeModule = require('../NativeRNPingDavinci');
      expect(nativeModule.getNativeModule()).toBe(classic);
    });
  });
});
