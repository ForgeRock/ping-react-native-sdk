/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { BrowserResult } from './types';

/**
 * Native configuration payload sent over the bridge (Android only).
 */
type NativeBrowserConfig = {
  browserPackage?: string;
  customTabs?: {
    showTitle?: boolean;
    urlBarHidingEnabled?: boolean;
    toolbarColor?: string;
    colorScheme?: string;
  };
  authTabs?: {
    ephemeral?: boolean;
    colorScheme?: string;
    toolbarColor?: string;
    navigationBarColor?: string;
    navigationBarDividerColor?: string;
  };
};

/**
 * Native module contract for the browser package.
 */
export interface Spec extends TurboModule {
  /**
   * Configure global browser behavior (Android only).
   */
  configure(config: NativeBrowserConfig): void;

  /**
   * Reset any in-flight browser session (iOS only).
   */
  reset(): void;

  /**
   * Launch the native browser session and resolve with either:
   * - { type: 'success', url } when a redirect is captured
   * - { type: 'cancel' } when the user cancels/dismisses
   */
  open(
    url: string,
    options: Object
  ): Promise<BrowserResult>;
}

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 */
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('RNPingBrowser');
  if (turbo) {
    return turbo;
  }

  const classic = NativeModules.RNPingBrowserClassic as Spec | undefined;
  if (classic) {
    return classic;
  }

  throw new Error(
    '[@ping-identity/rn-browser] Native module RNPingBrowser not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.\n' +
      'Available NativeModules: ' +
      JSON.stringify(Object.keys(NativeModules))
  );
}
