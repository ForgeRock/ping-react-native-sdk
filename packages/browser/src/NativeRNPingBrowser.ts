import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { BrowserResult } from './types';

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

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

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

export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingBrowser');
    } catch {
      // Fall back to classic if TurboModule isn't registered at runtime.
    }
  }

  const classic = NativeModules.RNPingBrowserClassic;
  if (!classic) {
    const available = Object.keys(NativeModules);
    throw new Error(
      '[@react-native-pingidentity/browser] Native RNPingBrowserClassic module not found.\n' +
        'Available NativeModules: ' +
        JSON.stringify(available)
    );
  }

  return classic as Spec;
}
