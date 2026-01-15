/**
 * Result of a browser launch.
 */
export type BrowserResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' };

/**
 * Configuration for launching the browser.
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
};

export type AndroidBrowserConfig = {
  browserPackage?: string;
  customTabs?: {
    showTitle?: boolean;
    urlBarHidingEnabled?: boolean;
    toolbarColor?: string;
    colorScheme?: 'system' | 'light' | 'dark';
  };
  authTabs?: {
    ephemeral?: boolean;
    colorScheme?: 'system' | 'light' | 'dark';
    toolbarColor?: string;
    navigationBarColor?: string;
    navigationBarDividerColor?: string;
  };
};

export type IOSBrowserConfig = {};

export type BrowserConfig = {
  android?: AndroidBrowserConfig;
  ios?: IOSBrowserConfig;
};
