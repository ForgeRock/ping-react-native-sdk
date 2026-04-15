/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import {
  JourneyProvider,
  useJourney,
  type JourneyHookResult,
} from '../useJourney';

type JourneyClient = import('../types').JourneyClient;
type JourneyNode = import('../types').JourneyNode;

type JourneyHarnessProps = {
  onResult: (result: JourneyHookResult) => void;
};

/**
 * Returns non-null hook result for assertions.
 *
 * @param result - Nullable hook result.
 * @returns Non-null hook result.
 * @throws {Error} When result is null.
 */
function requireLatest(result: JourneyHookResult | null): JourneyHookResult {
  if (!result) {
    throw new Error('Expected hook result to be available.');
  }
  return result;
}

/**
 * Hook harness that consumes Journey context.
 *
 * @param props - Harness props.
 * @returns Null render output.
 */
function JourneyHarness(props: JourneyHarnessProps): React.ReactElement | null {
  const { onResult } = props;
  const journey = useJourney();

  useEffect(() => {
    onResult(journey);
  }, [journey, onResult]);

  return null;
}

/**
 * Creates a typed Journey client mock.
 *
 * @returns Journey client mock.
 */
function createJourneyClientMock(): JourneyClient {
  const continueNode: JourneyNode = { type: 'ContinueNode', callbacks: [] };
  const successNode: JourneyNode = { type: 'SuccessNode' };

  return {
    init: jest.fn(async () => 'journey-id'),
    getId: jest.fn(async () => 'journey-id'),
    start: jest.fn(async () => continueNode),
    next: jest.fn(async () => successNode),
    resume: jest.fn(async () => continueNode),
    user: jest.fn(async () => null),
    refresh: jest.fn(async () => null),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => null),
    ssoToken: jest.fn(async () => null),
    logoutUser: jest.fn(async () => true),
    dispose: jest.fn(async () => undefined),
  };
}

describe('useJourney provider and native module resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when useJourney is used without a client or provider', () => {
    function MissingProviderHarness(): React.ReactElement | null {
      useJourney();
      return null;
    }

    expect(() => {
      render(<MissingProviderHarness />);
    }).toThrow('No Journey client found');
  });

  it('uses provider client when hook is consumed without direct client parameter', async () => {
    const client = createJourneyClientMock();
    let latest: JourneyHookResult | null = null;

    render(
      <JourneyProvider client={client}>
        <JourneyHarness
          onResult={(result) => {
            latest = result;
          }}
        />
      </JourneyProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
    });

    expect(client.start).toHaveBeenCalledWith('Login', {
      forceAuth: false,
      noSession: false,
    });
  });

  it('throws clear error when legacy native module is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        NativeModules: {},
        TurboModuleRegistry: { get: jest.fn() },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeModule = require('../NativeRNPingJourney');
      expect(() => nativeModule.getNativeModule()).toThrow(
        '[@ping-identity/rn-journey] Native module RNPingJourney not found.',
      );
    });
  });

  it('shares journey state across multiple consumers under the same provider', async () => {
    const client = createJourneyClientMock();
    let resultA: JourneyHookResult | null = null;
    let resultB: JourneyHookResult | null = null;

    render(
      <JourneyProvider client={client}>
        <JourneyHarness
          onResult={(r) => {
            resultA = r;
          }}
        />
        <JourneyHarness
          onResult={(r) => {
            resultB = r;
          }}
        />
      </JourneyProvider>,
    );

    await act(async () => {
      await requireLatest(resultA)[1].start('Login');
    });

    // Both consumers should reflect the same node from the shared provider state.
    expect(requireLatest(resultA)[0]).toEqual({
      type: 'ContinueNode',
      callbacks: [],
    });
    expect(requireLatest(resultB)[0]).toEqual({
      type: 'ContinueNode',
      callbacks: [],
    });
    // start() should only have been called once (not once per consumer).
    expect(client.start).toHaveBeenCalledTimes(1);
  });

  it('falls back to classic module when TurboModule is missing', () => {
    jest.isolateModules(() => {
      const classic = {};
      jest.doMock('react-native', () => ({
        NativeModules: { RNPingJourneyClassic: classic },
        TurboModuleRegistry: {
          get: jest.fn(() => undefined),
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeModule = require('../NativeRNPingJourney');
      expect(nativeModule.getNativeModule()).toBe(classic);
    });
  });
});
