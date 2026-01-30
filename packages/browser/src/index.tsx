/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

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
 * Android applies Custom Tabs/Auth Tabs settings globally; iOS is a no-op.
 *
 * @param config Platform-specific browser configuration.
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
 * iOS cancels the current browser flow if active; Android is a no-op.
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
 * Android uses Auth Tabs/Custom Tabs; iOS uses ASWebAuthenticationSession.
 *
 * @param url Target URL to open.
 * @param options Per-launch options and callback configuration.
 * @returns The browser result when the redirect is received or the user cancels.
 */
export function open(
  url: string,
  options: BrowserOpenOptions
): Promise<BrowserResult> {
  return getNativeModule().open(url, options as unknown as Object);
}

export type {
  BrowserConfig,
  BrowserError,
  BrowserErrorCode,
  IOSBrowserOpenOptions,
  BrowserOpenOptions,
  BrowserResult,
} from './types';
