/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnbrowser

import android.content.Intent
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabsIntent
import java.net.URL

/**
 * Adapter interface for interacting with the underlying BrowserLauncher.
 *
 * Provides a seam for tests and allows swapping the launch implementation.
 */
internal interface BrowserLauncherAdapter {
  var customTabsCustomizer: CustomTabsIntent.Builder.() -> Unit
  var authTabCustomizer: AuthTabIntent.Builder.() -> Unit
  var intentCustomizer: Intent.() -> Unit
  var redirectUri: Uri

  /**
   * Launch the browser flow and resolve with the redirect URI result.
   */
  suspend fun launch(url: URL, redirectUri: Uri): Result<Uri>
}
