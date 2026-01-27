/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getDeviceId } from '../index';

jest.mock('../NativeRNPingDeviceId', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
}));

import { getNativeModule } from '../NativeRNPingDeviceId';

describe('Device ID API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDeviceId forwards to native', async () => {
    const getDefaultDeviceId = jest.fn().mockResolvedValue('default-id');
    (getNativeModule as jest.Mock).mockReturnValue({ getDefaultDeviceId });

    await expect(getDeviceId()).resolves.toBe('default-id');
    expect(getDefaultDeviceId).toHaveBeenCalledTimes(1);
  });
});
