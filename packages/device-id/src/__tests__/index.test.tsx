/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getDeviceId } from '../index';

jest.mock('../NativeRNPingDeviceId', () => ({
  __esModule: true,
  default: {
    getDefaultDeviceId: jest.fn(),
  },
}));

import NativeRNPingDeviceId from '../NativeRNPingDeviceId';

describe('Device ID API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDeviceId forwards to native', async () => {
    (NativeRNPingDeviceId.getDefaultDeviceId as jest.Mock).mockResolvedValue('default-id');

    await expect(getDeviceId()).resolves.toBe('default-id');
    expect(NativeRNPingDeviceId.getDefaultDeviceId).toHaveBeenCalledTimes(1);
  });
});
