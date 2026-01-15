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

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

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
 * Resolve the native module, preferring TurboModules when enabled.
 *
 * @throws If the classic module is missing at runtime.
 */
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
