import { Platform } from 'react-native';
import { getNativeModule } from './NativeRNPingBrowser';

import type {
  BrowserConfig,
  BrowserOpenOptions,
  BrowserResult,
} from './types';

/**
 * Configure global browser behavior.
 *
 * Android:
 *  - Applies Custom Tabs / intent settings globally.
 *
 * iOS:
 *  - No-op (reserved for future).
 */
export function configureBrowser(config: BrowserConfig): void {
  if (Platform.OS !== 'android') {
    return;
  }

  getNativeModule().configure(config.android ?? {});
}

/**
 * Reset any in-flight browser session.
 *
 * iOS:
 *  - Cancels the current browser flow if active.
 *
 * Android:
 *  - No-op.
 */
export function resetBrowser(): void {
  if (Platform.OS !== 'ios') {
    return;
  }

  getNativeModule().reset();
}

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
  return getNativeModule().open(url, options as unknown as Object);
}

export type * from './types';
