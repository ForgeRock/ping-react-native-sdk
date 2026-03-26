/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getFido } from '../index';

jest.mock('../NativeRNPingFido', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
}));

import { getNativeModule } from '../NativeRNPingFido';

describe('FIDO API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getFido forwards to native', async () => {
    const getDefaultFido = jest.fn().mockResolvedValue('default-id');
    (getNativeModule as jest.Mock).mockReturnValue({ getDefaultFido });

    await expect(getFido()).resolves.toBe('default-id');
    expect(getDefaultFido).toHaveBeenCalledTimes(1);
  });
});
