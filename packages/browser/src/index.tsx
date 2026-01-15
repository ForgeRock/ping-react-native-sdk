import { getNativeModule } from './NativeRNPingBrowser';

import type { BrowserOpenOptions, BrowserResult } from './types';

/**
 * Launch a secure system browser and wait for redirect or cancellation.
 *
 * Native behavior:
 *  - Android: Automatically selects Auth Tabs or Custom Tabs.
 *  - iOS: Uses ASWebAuthenticationSession (or ephemeral variant internally).
 */
export function open(
  url: string,
  options: BrowserOpenOptions
): Promise<BrowserResult> {
  return getNativeModule().open(url, options);
}

export type * from './types';
