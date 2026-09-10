/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';
import type {
  DeviceAuthGrantHookResult,
  OidcDeviceClient,
  OidcDeviceFlowStatus,
} from '../index';
import { DeviceAuthGrantProvider, useDeviceAuthGrant } from '../index';

jest.mock('../deviceOpenVerificationUrl', () => ({
  registerDeviceClientLogger: jest.fn(),
  removeDeviceClientLogger: jest.fn(),
  deviceOpenVerificationUrl: jest.fn(async () => ({ type: 'success' })),
}));

const deviceOpenVerificationUrlMock = jest.requireMock(
  '../deviceOpenVerificationUrl',
).deviceOpenVerificationUrl as jest.Mock;

function requireLatest(
  result: DeviceAuthGrantHookResult | null,
): DeviceAuthGrantHookResult {
  if (!result) throw new Error('Expected hook result to be available.');
  return result;
}

type HarnessProps = {
  onResult: (result: DeviceAuthGrantHookResult) => void;
};

function Harness({ onResult }: HarnessProps): React.ReactElement | null {
  const result = useDeviceAuthGrant();
  useEffect(() => {
    onResult(result);
  }, [onResult, result]);
  return null;
}

function createClientMock(
  overrides: Partial<OidcDeviceClient> = {},
): OidcDeviceClient {
  const user = {
    token: jest.fn(async () => ({ accessToken: 'access-token' })),
    refresh: jest.fn(async () => ({ accessToken: 'refreshed-token' })),
    userinfo: jest.fn(async () => ({ sub: 'user' })),
    revoke: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
  };

  return {
    id: 'device-client',
    authorize: jest.fn(
      async (onStatus: (status: OidcDeviceFlowStatus) => void) => {
        onStatus({
          type: 'started',
          response: {
            deviceCode: 'device-code',
            userCode: 'user-code',
            verificationUri: 'https://example.com/verify',
            expiresIn: 600,
            interval: 5,
          },
        });
        onStatus({ type: 'success' });
        return jest.fn();
      },
    ),
    user: jest.fn(async () => user),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('useDeviceAuthGrant provider', () => {
  it('exposes a typed error when used without a direct client or provider', async () => {
    let latest: DeviceAuthGrantHookResult | null = null;
    render(
      <Harness
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    await act(async () => {
      await expect(requireLatest(latest)[1].restore()).rejects.toThrow(
        'No OIDC device client found',
      );
    });
  });

  it('restores on provider mount and shares state across consumers', async () => {
    const client = createClientMock();
    let resultA: DeviceAuthGrantHookResult | null = null;
    let resultB: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            resultA = result;
          }}
        />
        <Harness
          onResult={(result) => {
            resultB = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(resultA)[1].restore();
    });

    expect(client.user).toHaveBeenCalled();
    expect(requireLatest(resultA)[0].isAuthenticated).toBe(true);
    expect(requireLatest(resultB)[0].user).toBe(requireLatest(resultA)[0].user);
  });

  it('updates shared state when authorization succeeds', async () => {
    const client = createClientMock();
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });

    expect(requireLatest(latest)[0].status).toEqual({ type: 'success' });
    expect(requireLatest(latest)[0].isAuthenticated).toBe(true);
  });

  it('delegates token operations and clears state on logout', async () => {
    const client = createClientMock();
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].token();
      await requireLatest(latest)[1].refresh();
      await requireLatest(latest)[1].userinfo(true);
      await requireLatest(latest)[1].logout();
    });

    expect(requireLatest(latest)[0].isAuthenticated).toBe(false);
  });

  it('starts a fresh authorization after cancel supersedes an in-flight one', async () => {
    let resolveFirstNativeCall: ((stop: () => void) => void) | null = null;
    const firstNativeCall = new Promise<() => void>((resolve) => {
      resolveFirstNativeCall = resolve;
    });
    const stopFirst = jest.fn();
    const stopSecond = jest.fn();
    const authorizeMock = jest
      .fn()
      .mockImplementationOnce(async () => firstNativeCall)
      .mockImplementationOnce(async () => stopSecond);
    const client = createClientMock({ authorize: authorizeMock });
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    // Start the first authorization; its native call never resolves yet, so
    // this leaves authorizeInFlightRef pointing at a still-pending promise.
    let firstAuthorizeSettled: Promise<void> | null = null;
    await act(async () => {
      firstAuthorizeSettled = requireLatest(latest)[1].authorize();
      await Promise.resolve();
    });

    await act(async () => {
      requireLatest(latest)[1].cancel();
    });

    // Without the fix, this would return the still-pending first promise
    // instead of issuing a new native authorize() call.
    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });

    expect(authorizeMock).toHaveBeenCalledTimes(2);
    expect(stopSecond).not.toHaveBeenCalled();

    // Let the superseded first call resolve late and confirm it stops itself
    // instead of overwriting the active (second) flow's stop function.
    await act(async () => {
      resolveFirstNativeCall?.(stopFirst);
      await firstAuthorizeSettled;
    });

    expect(stopFirst).toHaveBeenCalled();
    expect(stopSecond).not.toHaveBeenCalled();
  });

  it('invalidates an in-flight authorization when the provider client changes', async () => {
    let resolveFirstNativeCall: ((stop: () => void) => void) | null = null;
    const firstNativeCall = new Promise<() => void>((resolve) => {
      resolveFirstNativeCall = resolve;
    });
    const stopFirst = jest.fn();
    const stopSecond = jest.fn();
    const authorizeMock = jest
      .fn()
      .mockImplementationOnce(async () => firstNativeCall)
      .mockImplementationOnce(async () => stopSecond);
    const firstClient = createClientMock({
      id: 'first',
      authorize: authorizeMock,
    });
    const secondClient = createClientMock({ id: 'second' });
    let latest: DeviceAuthGrantHookResult | null = null;

    const screen = render(
      <DeviceAuthGrantProvider client={firstClient}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    // Start the first authorization against the first client; its native
    // call never resolves yet.
    let firstAuthorizeSettled: Promise<void> | null = null;
    await act(async () => {
      firstAuthorizeSettled = requireLatest(latest)[1].authorize();
      await Promise.resolve();
    });

    // Swap the client mid-flight; the cleanup must clear the in-flight ref
    // and invalidate the first flow's token.
    await act(async () => {
      screen.rerender(
        <DeviceAuthGrantProvider client={secondClient}>
          <Harness
            onResult={(result) => {
              latest = result;
            }}
          />
        </DeviceAuthGrantProvider>,
      );
    });

    // Without the fix, this would return the still-pending first promise
    // instead of issuing a new native authorize() call on the new client.
    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });

    expect(secondClient.authorize).toHaveBeenCalledTimes(1);

    // The superseded first call resolves late and stops itself.
    await act(async () => {
      resolveFirstNativeCall?.(stopFirst);
      await firstAuthorizeSettled;
    });

    expect(stopFirst).toHaveBeenCalled();
    expect(stopSecond).not.toHaveBeenCalled();
  });

  it('cancels active authorization on unmount without disposing the client', async () => {
    const stop = jest.fn();
    const client = createClientMock({
      authorize: jest.fn(async () => stop),
    });
    let latest: DeviceAuthGrantHookResult | null = null;

    const screen = render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });
    screen.unmount();

    expect(stop).toHaveBeenCalled();
    expect(client.dispose).not.toHaveBeenCalled();
  });

  it('opens the verification URL from the latest authorization response', async () => {
    deviceOpenVerificationUrlMock.mockClear();
    const client = createClientMock();
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });

    await act(async () => {
      await requireLatest(latest)[1].openVerificationUrl();
    });

    expect(deviceOpenVerificationUrlMock).toHaveBeenCalledWith(
      client,
      'https://example.com/verify',
    );
  });

  it('prefers verificationUriComplete over verificationUri', async () => {
    deviceOpenVerificationUrlMock.mockResolvedValueOnce({
      type: 'cancel',
    });
    const client = createClientMock({
      authorize: jest.fn(
        async (onStatus: (status: OidcDeviceFlowStatus) => void) => {
          onStatus({
            type: 'started',
            response: {
              deviceCode: 'device-code',
              userCode: 'user-code',
              verificationUri: 'https://example.com/verify',
              verificationUriComplete: 'https://example.com/verify?code=x',
              expiresIn: 600,
              interval: 5,
            },
          });
          onStatus({ type: 'success' });
          return jest.fn();
        },
      ),
    });
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].authorize();
    });

    await act(async () => {
      await expect(
        requireLatest(latest)[1].openVerificationUrl(),
      ).resolves.toEqual({ type: 'cancel' });
    });

    expect(deviceOpenVerificationUrlMock).toHaveBeenCalledWith(
      client,
      'https://example.com/verify?code=x',
    );
  });

  it('falls back to an empty URL when no authorization response exists', async () => {
    // With no response the hook forwards an empty URL; the facade rejects
    // blank URLs with argument_error (covered by the index tests).
    const client = createClientMock();
    let latest: DeviceAuthGrantHookResult | null = null;

    render(
      <DeviceAuthGrantProvider client={client}>
        <Harness
          onResult={(result) => {
            latest = result;
          }}
        />
      </DeviceAuthGrantProvider>,
    );

    await act(async () => {
      await requireLatest(latest)[1].openVerificationUrl();
    });

    expect(deviceOpenVerificationUrlMock).toHaveBeenCalledWith(client, '');
  });
});
