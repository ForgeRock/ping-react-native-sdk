/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Result of a browser launch.
 */
export type BrowserResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' };

/**
 * Configuration for launching the browser.
 *
 * @remarks
 * The `callbackUrlScheme` is required to receive the redirect back into the app.
 */
export type BrowserOpenOptions = {
  /**
   * App callback scheme used to receive the redirect.
   *
   * Examples:
   *   - "myapp"
   *   - "com.company.myapp"
   *
   * iOS:
   *   Passed to ASWebAuthenticationSession callbackURLScheme.
   *
   * Android:
   *   Used for per-launch redirect handling and must match
   *   the manifestPlaceholder `appRedirectUriScheme`.
   */
  callbackUrlScheme: string;

  /**
   * Optional full redirect URI override.
   *
   * Android:
   *   Supported and recommended for per-launch configuration.
   *
   * iOS:
   *   Typically handled by the authentication layer; ignored if not applicable.
   */
  redirectUri?: string;

  /**
   * iOS-only options.
   */
  ios?: {
    /**
     * Browser type for iOS.
     *
     * @remarks
     * Only `authSession` and `ephemeralAuthSession` are implemented.
     */
    browserType?: 'authSession' | 'ephemeralAuthSession';

    /**
     * Browser mode (reserved; currently informational).
     */
    browserMode?: 'login' | 'logout' | 'custom';
  };
};

/**
 * Android-only global configuration for browser sessions.
 */
export type AndroidBrowserConfig = {
  /**
   * Force a specific browser package (e.g. Chrome, Edge).
   */
  browserPackage?: string;
  customTabs?: {
    /**
     * Show or hide the page title.
     */
    showTitle?: boolean;
    /**
     * Allow the URL bar to hide while scrolling.
     */
    urlBarHidingEnabled?: boolean;
    /**
     * Toolbar color override.
     */
    toolbarColor?: string;
    /**
     * Color scheme preference for the tab UI.
     */
    colorScheme?: 'system' | 'light' | 'dark';
  };
  authTabs?: {
    /**
     * Prefer ephemeral browsing where supported.
     */
    ephemeral?: boolean;
    /**
     * Color scheme preference for the tab UI.
     */
    colorScheme?: 'system' | 'light' | 'dark';
    /**
     * Toolbar color override.
     */
    toolbarColor?: string;
    /**
     * Navigation bar color override.
     */
    navigationBarColor?: string;
    /**
     * Divider color between navigation bar and content.
     */
    navigationBarDividerColor?: string;
  };
};

/**
 * iOS-only global configuration.
 */
export type IOSBrowserConfig = {};

/**
 * Cross-platform configuration wrapper.
 */
export type BrowserConfig = {
  android?: AndroidBrowserConfig;
  ios?: IOSBrowserConfig;
};
