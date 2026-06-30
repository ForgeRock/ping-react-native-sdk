/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import * as DavinciIndex from '../index';

describe('@ping-identity/rn-davinci public export surface', () => {
  it('exports createDaVinciClient', () => {
    expect(typeof DavinciIndex.createDaVinciClient).toBe('function');
  });

  it('exports collector helpers', () => {
    expect(typeof DavinciIndex.buildNextInput).toBe('function');
    expect(typeof DavinciIndex.computeFormMeta).toBe('function');
    expect(typeof DavinciIndex.normalizeCollectors).toBe('function');
    expect(typeof DavinciIndex.resolveExecutionMode).toBe('function');
  });

  it('exports React provider and hook', () => {
    expect(typeof DavinciIndex.DaVinciProvider).toBe('function');
    expect(typeof DavinciIndex.useDaVinci).toBe('function');
    expect(typeof DavinciIndex.useDaVinciForm).toBe('function');
  });

  it('exports DaVinciError class', () => {
    expect(typeof DavinciIndex.DaVinciError).toBe('function');
    const err = new DavinciIndex.DaVinciError(
      'msg',
      'DAVINCI_UNKNOWN_ERROR',
      'unknown',
    );
    expect(err.name).toBe('DaVinciError');
    expect((err as { code: string }).code).toBe('DAVINCI_UNKNOWN_ERROR');
  });

  it('does not export internal helpers', () => {
    expect('getNativeModule' in DavinciIndex).toBe(false);
    expect('_resetNativeModuleForTesting' in DavinciIndex).toBe(false);
    expect('configureDaVinci' in DavinciIndex).toBe(false);
    expect('startDaVinci' in DavinciIndex).toBe(false);
    expect('nextDaVinci' in DavinciIndex).toBe(false);
  });
});
