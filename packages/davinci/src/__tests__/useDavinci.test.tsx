/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import { useDaVinci } from '../useDavinci';

type DaVinciClient = import('../types').DaVinciClient;
type DaVinciNode = import('../types').DaVinciNode;
type DaVinciHookResult = import('../useDavinci').DaVinciHookResult;
type PollingStatus = import('../types').PollingStatus;

type Harness = {
  client: DaVinciClient;
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
 * Test harness for observing `useDaVinci` state.
 *
 * @param props - Harness props.
 * @returns Null render output.
 */
function DaVinciHarness(props: Harness): React.ReactElement | null {
  const { client, onResult } = props;
  const davinci = useDaVinci(client);

  useEffect(() => {
    onResult(davinci);
  }, [davinci, onResult]);

  return null;
}

const continueNode: DaVinciNode = {
  type: 'ContinueNode',
  collectors: [
    {
      key: 'username',
      type: 'TEXT',
      label: 'Username',
      required: true,
      value: '',
    },
    {
      key: 'password',
      type: 'PASSWORD',
      label: 'Password',
      required: true,
      value: '',
    },
    { key: 'submit', type: 'SUBMIT_BUTTON', label: 'Submit', required: false },
    { key: 'forgot', type: 'FLOW_BUTTON', label: 'Forgot?', required: false },
  ],
};

const successNode: DaVinciNode = {
  type: 'SuccessNode',
  session: { value: 'tok' },
};

/**
 * Creates a typed DaVinci client mock.
 *
 * @param overrides - Optional client overrides.
 * @returns DaVinci client mock.
 */
function createDaVinciClientMock(
  overrides: Partial<DaVinciClient> = {},
): DaVinciClient {
  return {
    start: jest.fn(async () => continueNode),
    next: jest.fn(async () => successNode),
    user: jest.fn(async () => null),
    refresh: jest.fn(async () => null),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => null),
    logoutUser: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
    getId: jest.fn(async () => 'davinci-id'),
    pollStatus: jest.fn(async () => jest.fn()),
    ...overrides,
  };
}

describe('useDaVinci', () => {
  it('starts the flow and exposes the node', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    const result = requireLatest(latest);
    expect(result.node).toBe(continueNode);
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
  });

  it('next() requires an active node', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let err: unknown;
    await act(async () => {
      err = await requireLatest(latest)
        .next({ collectors: [] })
        .catch((e: unknown) => e);
    });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('DaVinciError');
    expect((err as { code: string }).code).toBe('DAVINCI_STATE_ERROR');
  });

  it('next() rejects when the current node is terminal', async () => {
    const client = createDaVinciClientMock({
      start: jest.fn(async () => successNode),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    let err: unknown;
    await act(async () => {
      err = await requireLatest(latest)
        .next({ collectors: [] })
        .catch((e: unknown) => e);
    });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('DaVinciError');
    expect((err as { code: string }).code).toBe('DAVINCI_STATE_ERROR');
    expect(client.next).not.toHaveBeenCalled();
  });

  it('next() advances the flow when node is active', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    await act(async () => {
      await requireLatest(latest).next({ collectors: [] });
    });

    expect(requireLatest(latest).node).toBe(successNode);
  });

  it('revoke resets node on success', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    await act(async () => {
      await requireLatest(latest).revoke();
    });

    expect(requireLatest(latest).node).toBeNull();
    expect(client.logoutUser).not.toHaveBeenCalled();
  });

  it('logoutUser resets node', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    await act(async () => {
      await requireLatest(latest).logoutUser();
    });

    expect(requireLatest(latest).node).toBeNull();
  });

  it('dispose resets node and error', async () => {
    const client = createDaVinciClientMock();
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).start();
    });

    await act(async () => {
      await requireLatest(latest).dispose();
    });

    expect(requireLatest(latest).node).toBeNull();
    expect(requireLatest(latest).error).toBeNull();
  });

  it('captures start() errors into hook error state', async () => {
    const client = createDaVinciClientMock({
      start: jest.fn(async () => {
        throw {
          type: 'state_error',
          error: 'DAVINCI_START_ERROR',
          message: 'boom',
        };
      }),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest)
        .start()
        .catch(() => undefined);
    });

    const result = requireLatest(latest);
    expect(result.error).not.toBeNull();
    expect(result.error?.name).toBe('DaVinciError');
    expect((result.error as { code: string }).code).toBe('DAVINCI_START_ERROR');
  });

  it('user() delegates to the client and returns its result', async () => {
    const session = { value: 'tok' };
    const client = createDaVinciClientMock({
      user: jest.fn(async () => session),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let result: unknown;
    await act(async () => {
      result = await requireLatest(latest).user();
    });

    expect(result).toBe(session);
    expect(client.user).toHaveBeenCalledTimes(1);
  });

  it('refresh() delegates to the client and returns its result', async () => {
    const session = { value: 'refreshed' };
    const client = createDaVinciClientMock({
      refresh: jest.fn(async () => session),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let result: unknown;
    await act(async () => {
      result = await requireLatest(latest).refresh();
    });

    expect(result).toBe(session);
    expect(client.refresh).toHaveBeenCalledTimes(1);
  });

  it('userinfo() delegates to the client and returns its result', async () => {
    const claims = { sub: 'user-1' };
    const client = createDaVinciClientMock({
      userinfo: jest.fn(async () => claims),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let result: unknown;
    await act(async () => {
      result = await requireLatest(latest).userinfo();
    });

    expect(result).toBe(claims);
    expect(client.userinfo).toHaveBeenCalledTimes(1);
  });

  it('pollStatus() delegates to the client with the callback and options', async () => {
    const unsubscribe = jest.fn();
    const pollStatusMock = jest.fn(async () => unsubscribe);
    const client = createDaVinciClientMock({ pollStatus: pollStatusMock });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    const onStatus = jest.fn((_status: PollingStatus) => undefined);
    let result: (() => void) | undefined;
    await act(async () => {
      result = await requireLatest(latest).pollStatus(onStatus, {
        key: 'poll-key',
      });
    });

    expect(pollStatusMock).toHaveBeenCalledWith(onStatus, { key: 'poll-key' });
    expect(result).toBe(unsubscribe);
  });

  it('pollStatus() propagates rejection when no PollingCollector is resolved', async () => {
    const pollError = {
      type: 'state_error',
      error: 'DAVINCI_STATE_ERROR',
      message: 'No active PollingCollector resolved.',
    };
    const client = createDaVinciClientMock({
      pollStatus: jest.fn(async () => {
        throw pollError;
      }),
    });
    let latest: DaVinciHookResult | null = null;

    render(
      <DaVinciHarness
        client={client}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let err: unknown;
    await act(async () => {
      err = await requireLatest(latest)
        .pollStatus(jest.fn())
        .catch((e: unknown) => e);
    });

    expect(err).toBe(pollError);
  });
});
