import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { BrowserResult } from './types';

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

export interface Spec extends TurboModule {
  /**
   * Launch the native browser session and resolve with either:
   * - { type: 'success', url } when a redirect is captured
   * - { type: 'cancel' } when the user cancels/dismisses
   */
  open(
    url: string,
    options: {
      callbackUrlScheme: string;
      redirectUri?: string;
    }
  ): Promise<BrowserResult>;
}

export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    // Temporary debug to confirm TurboModule availability in runtime.
    console.warn(
      '[@react-native-pingidentity/browser] TurboModule proxy present; trying TurboModule.'
    );
    try {
      return TurboModuleRegistry.getEnforcing<Spec>('RNPingBrowser');
    } catch {
      console.warn(
        '[@react-native-pingidentity/browser] TurboModule not registered; falling back to classic.'
      );
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

export default getNativeModule();
