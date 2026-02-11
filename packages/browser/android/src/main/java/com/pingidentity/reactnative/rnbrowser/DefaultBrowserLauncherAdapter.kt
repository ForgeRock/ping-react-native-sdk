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
import com.pingidentity.browser.BrowserLauncher
import java.net.URL

/**
 * Default adapter that delegates to the Ping BrowserLauncher singleton.
 */
internal object DefaultBrowserLauncherAdapter : BrowserLauncherAdapter {
  override var customTabsCustomizer: CustomTabsIntent.Builder.() -> Unit
    get() = BrowserLauncher.customTabsCustomizer
    set(value) {
      BrowserLauncher.customTabsCustomizer = value
    }

  override var authTabCustomizer: AuthTabIntent.Builder.() -> Unit
    get() = BrowserLauncher.authTabCustomizer
    set(value) {
      BrowserLauncher.authTabCustomizer = value
    }

  override var intentCustomizer: Intent.() -> Unit
    get() = BrowserLauncher.intentCustomizer
    set(value) {
      BrowserLauncher.intentCustomizer = value
    }

  override var redirectUri: Uri
    get() = BrowserLauncher.redirectUri
    set(value) {
      BrowserLauncher.redirectUri = value
    }

  override suspend fun launch(url: URL, redirectUri: Uri): Result<Uri> {
    return BrowserLauncher.launch(url, redirectUri)
  }
}
