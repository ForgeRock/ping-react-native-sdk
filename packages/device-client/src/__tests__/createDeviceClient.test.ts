/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { createDeviceClient } from '../createDeviceClient';

jest.mock('../NativeRNPingDeviceClient', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
}));

import { getNativeModule } from '../NativeRNPingDeviceClient';

function mockNative() {
  const native = {
    create: jest.fn().mockResolvedValue('handle-1'),
    get: jest.fn(),
    update: jest.fn(),
    deleteDevice: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  };
  (getNativeModule as jest.Mock).mockReturnValue(native);
  return native;
}

describe('createDeviceClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws when required config fields are missing', () => {
    mockNative();
    expect(() =>
      createDeviceClient({
        serverUrl: '',
        ssoToken: 'x',
        realm: 'r',
        cookieName: 'c',
      }),
    ).toThrow(/serverUrl.*ssoToken.*realm.*cookieName/);
    expect(() =>
      createDeviceClient({
        serverUrl: 'https://x',
        ssoToken: 't',
        realm: '',
        cookieName: 'c',
      }),
    ).toThrow(/serverUrl.*ssoToken.*realm.*cookieName/);
  });

  it('creates a native handle lazily on first operation', async () => {
    const native = mockNative();
    native.get.mockResolvedValue({ result: [] });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'root',
      cookieName: 'iPlanetDirectoryPro',
    });
    expect(native.create).not.toHaveBeenCalled();

    await client.oath.get();
    expect(native.create).toHaveBeenCalledTimes(1);
    expect(native.create).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: 'https://x',
        ssoToken: 't',
        realm: 'root',
        cookieName: 'iPlanetDirectoryPro',
      }),
    );
  });

  it('reuses the same native handle across operations', async () => {
    const native = mockNative();
    native.get.mockResolvedValue({ result: [] });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'root',
      cookieName: 'iPlanetDirectoryPro',
    });
    await client.oath.get();
    await client.push.get();
    await client.bound.get();

    expect(native.create).toHaveBeenCalledTimes(1);
    expect(native.get).toHaveBeenNthCalledWith(1, 'handle-1', 'oath');
    expect(native.get).toHaveBeenNthCalledWith(2, 'handle-1', 'push');
    expect(native.get).toHaveBeenNthCalledWith(3, 'handle-1', 'bound');
  });

  it('unwraps `{ result: [...] }` from native get', async () => {
    const native = mockNative();
    const devices = [{ id: '1', deviceName: 'A' }];
    native.get.mockResolvedValue({ result: devices });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'root',
      cookieName: 'iPlanetDirectoryPro',
    });
    await expect(client.oath.get()).resolves.toEqual(devices);
  });

  it('unwraps update result and forwards payload', async () => {
    const native = mockNative();
    const device = { id: '1', deviceName: 'A' };
    native.update.mockResolvedValue({ result: { ...device, deviceName: 'B' } });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'root',
      cookieName: 'iPlanetDirectoryPro',
    });
    await expect(
      client.oath.update({ ...device, deviceName: 'B' } as never),
    ).resolves.toMatchObject({ deviceName: 'B' });
    expect(native.update).toHaveBeenCalledWith('handle-1', 'oath', {
      id: '1',
      deviceName: 'B',
    });
  });

  it('dispose releases handle and subsequent ops throw', async () => {
    const native = mockNative();
    native.get.mockResolvedValue({ result: [] });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'root',
      cookieName: 'iPlanetDirectoryPro',
    });
    await client.oath.get();
    await client.dispose();
    expect(native.dispose).toHaveBeenCalledWith('handle-1');

    await expect(client.oath.get()).rejects.toThrow(/disposed/);
  });

  it('applies realm/cookieName overrides', async () => {
    const native = mockNative();
    native.get.mockResolvedValue({ result: [] });

    const client = createDeviceClient({
      serverUrl: 'https://x',
      ssoToken: 't',
      realm: 'alpha',
      cookieName: 'custom',
    });
    await client.oath.get();
    expect(native.create).toHaveBeenCalledWith(
      expect.objectContaining({ realm: 'alpha', cookieName: 'custom' }),
    );
  });
});
