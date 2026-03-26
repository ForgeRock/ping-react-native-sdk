/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getNativeModule } from './NativeRNPingFido';

/**
 * Returns the default FIDO identifier from the native module.
 *
 * @returns A promise that resolves to the identifier string.
 *
 * @remarks
 * Promise rejections use {@link FidoError}.
 *
 * @example
 * ```typescript
 * import { getFido } from '@ping-identity/rn-fido';
 *
 * const fido = await getFido();
 * console.log('FIDO:', fido);
 * ```
 */
export async function getFido(): Promise<string> {
  return await getNativeModule().getDefaultFido();
}

export type { FidoError, FidoErrorCode } from './types';
