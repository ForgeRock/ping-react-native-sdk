/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import { useJourney } from '../useJourney';

type JourneyClient = import('../types').JourneyClient;
type JourneyHookResult = import('../useJourney').JourneyHookResult;
type JourneyNode = import('../types').JourneyNode;

type JourneyHarnessProps = {
  client: JourneyClient;
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
 * Test harness for observing `useJourney` state.
 *
 * @param props - Harness props.
 * @returns Null render output.
 */
function JourneyHarness(props: JourneyHarnessProps): React.ReactElement | null {
  const { client, onResult } = props;
  const journey = useJourney(client);

  useEffect(() => {
    onResult(journey);
  }, [journey, onResult]);

  return null;
}

/**
 * Creates a typed Journey client mock with defaults.
 *
 * @param overrides - Optional client overrides.
 * @returns Journey client mock.
 */
function createJourneyClientMock(overrides: Partial<JourneyClient> = {}): JourneyClient {
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
    ...overrides,
  };
}

describe('useJourney auto polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('auto-advances PollingWaitCallback nodes when no manual callbacks exist', async () => {
    const pollingNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'PollingWaitCallback', waitTime: 1200, output: [] }],
    };
    const successNode: JourneyNode = { type: 'SuccessNode' };
    const nextSpy = jest
      .fn()
      .mockResolvedValueOnce(successNode)
      .mockResolvedValue(successNode);
    const client = createJourneyClientMock({
      start: jest.fn(async () => pollingNode),
      next: nextSpy,
    });

    let latest: JourneyHookResult | null = null;
    render(
      <JourneyHarness
        client={client}
        onResult={(result) => {
          latest = result;
        }}
      />
    );

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
    });

    expect(nextSpy).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    expect(nextSpy).toHaveBeenCalledWith({});
    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  it('does not auto-advance when PollingWaitCallback node includes manual callbacks', async () => {
    const pollingAndManualNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'PollingWaitCallback', waitTime: 1000, output: [] },
        { type: 'NameCallback', output: [] },
      ],
    };
    const successNode: JourneyNode = { type: 'SuccessNode' };
    const nextSpy = jest.fn(async () => successNode);
    const client = createJourneyClientMock({
      start: jest.fn(async () => pollingAndManualNode),
      next: nextSpy,
    });

    let latest: JourneyHookResult | null = null;
    render(
      <JourneyHarness
        client={client}
        onResult={(result) => {
          latest = result;
        }}
      />
    );

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(nextSpy).not.toHaveBeenCalled();
  });

  it('uses the first PollingWaitCallback waitTime when multiple are present', async () => {
    const multiPollingNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'PollingWaitCallback', waitTime: 2000, output: [] },
        { type: 'PollingWaitCallback', waitTime: 500, output: [] },
      ],
    };
    const successNode: JourneyNode = { type: 'SuccessNode' };
    const nextSpy = jest
      .fn()
      .mockResolvedValueOnce(successNode)
      .mockResolvedValue(successNode);
    const client = createJourneyClientMock({
      start: jest.fn(async () => multiPollingNode),
      next: nextSpy,
    });

    let latest: JourneyHookResult | null = null;
    render(
      <JourneyHarness
        client={client}
        onResult={(result) => {
          latest = result;
        }}
      />
    );

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(nextSpy).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  it('clears pending polling timer when component unmounts', async () => {
    const pollingNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'PollingWaitCallback', waitTime: 1200, output: [] }],
    };
    const nextSpy = jest.fn(async () => ({ type: 'SuccessNode' } as JourneyNode));
    const client = createJourneyClientMock({
      start: jest.fn(async () => pollingNode),
      next: nextSpy,
    });

    let latest: JourneyHookResult | null = null;
    let unmount: (() => void) | null = null;
    const rendered = render(
      <JourneyHarness
        client={client}
        onResult={(result) => {
          latest = result;
        }}
      />
    );
    unmount = rendered.unmount;

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
    });

    act(() => {
      unmount?.();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(nextSpy).not.toHaveBeenCalled();
  });

  it('clears pending polling timer when node changes to non-auto-poll state', async () => {
    const pollingNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'PollingWaitCallback', waitTime: 1500, output: [] }],
    };
    const manualNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };
    const nextSpy = jest.fn(async () => ({ type: 'SuccessNode' } as JourneyNode));
    const client = createJourneyClientMock({
      start: jest.fn(async () => pollingNode),
      resume: jest.fn(async () => manualNode),
      next: nextSpy,
    });

    let latest: JourneyHookResult | null = null;
    render(
      <JourneyHarness
        client={client}
        onResult={(result) => {
          latest = result;
        }}
      />
    );

    await act(async () => {
      await requireLatest(latest)[1].start('Login');
      await requireLatest(latest)[1].resume('com.example.app://resume');
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(nextSpy).not.toHaveBeenCalled();
  });
});
