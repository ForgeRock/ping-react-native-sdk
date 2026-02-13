/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnbrowser

import android.graphics.Color
import androidx.browser.auth.AuthTabColorSchemeParams
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.reactnative.rncore.error.ErrorType
import com.pingidentity.reactnative.rncore.error.GenericError
import com.pingidentity.reactnative.rncore.error.reject
import java.net.URL
import java.net.MalformedURLException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Common utilities for the Ping Browser module.
 */
object RNPingBrowserCommon {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var appContext: ReactApplicationContext? = null
  internal var browserLauncher: BrowserLauncherAdapter = DefaultBrowserLauncherAdapter
  internal var mapFactory: () -> WritableMap = { Arguments.createMap() }

  /**
   * Apply global browser configuration from JS.
   */
  @JvmStatic
  fun configure(config: ReadableMap, reactContext: ReactApplicationContext) {
    appContext = reactContext
    val customTabsConfig = if (config.hasKey("customTabs")) {
      config.getMap("customTabs")
    } else {
      null
    }

    val authTabsConfig = if (config.hasKey("authTabs")) {
      config.getMap("authTabs")
    } else {
      null
    }

    val browserPackage = if (config.hasKey("browserPackage")) {
      config.getString("browserPackage")
    } else {
      null
    }

    browserLauncher.customTabsCustomizer = {
      val colorParamsBuilder = CustomTabColorSchemeParams.Builder()
      var hasColors = false
      customTabsConfig?.let { map ->
        if (map.hasKey("showTitle")) {
          setShowTitle(map.getBoolean("showTitle"))
        }
        if (map.hasKey("urlBarHidingEnabled")) {
          setUrlBarHidingEnabled(map.getBoolean("urlBarHidingEnabled"))
        }
        if (map.hasKey("toolbarColor")) {
          val colorValue = map.getString("toolbarColor")
          if (!colorValue.isNullOrBlank()) {
            colorParamsBuilder.setToolbarColor(Color.parseColor(colorValue))
            hasColors = true
          }
        }
        if (map.hasKey("colorScheme")) {
          when (map.getString("colorScheme")?.lowercase()) {
            "light" -> setColorScheme(CustomTabsIntent.COLOR_SCHEME_LIGHT)
            "dark" -> setColorScheme(CustomTabsIntent.COLOR_SCHEME_DARK)
            "system" -> setColorScheme(CustomTabsIntent.COLOR_SCHEME_SYSTEM)
          }
        }
      }
      if (hasColors) {
        setDefaultColorSchemeParams(colorParamsBuilder.build())
      }
    }

    browserLauncher.authTabCustomizer = {
      authTabsConfig?.let { map ->
        if (map.hasKey("ephemeral")) {
          val enabled = map.getBoolean("ephemeral")
          invokeAuthTabBuilderMethod(this, "setEphemeralBrowsingEnabled", enabled)
        }
        if (map.hasKey("colorScheme")) {
          val scheme = when (map.getString("colorScheme")?.lowercase()) {
            "light" -> CustomTabsIntent.COLOR_SCHEME_LIGHT
            "dark" -> CustomTabsIntent.COLOR_SCHEME_DARK
            "system" -> CustomTabsIntent.COLOR_SCHEME_SYSTEM
            else -> null
          }
          if (scheme != null) {
            invokeAuthTabBuilderMethod(this, "setColorScheme", scheme)
          }
        }

        val colorParamsBuilder = AuthTabColorSchemeParams.Builder()
        var hasColors = false
        map.getString("toolbarColor")?.takeIf { it.isNotBlank() }?.let { value ->
          colorParamsBuilder.setToolbarColor(Color.parseColor(value))
          hasColors = true
        }
        map.getString("navigationBarColor")?.takeIf { it.isNotBlank() }?.let { value ->
          colorParamsBuilder.setNavigationBarColor(Color.parseColor(value))
          hasColors = true
        }
        map.getString("navigationBarDividerColor")?.takeIf { it.isNotBlank() }?.let { value ->
          colorParamsBuilder.setNavigationBarDividerColor(Color.parseColor(value))
          hasColors = true
        }
        if (hasColors) {
          invokeAuthTabBuilderMethod(this, "setDefaultColorSchemeParams", colorParamsBuilder.build())
        }
      }
    }

    val resolvedPackage = if (browserPackage.isNullOrBlank()) {
      null
    } else if (isPackageInstalled(browserPackage)) {
      browserPackage
    } else {
      null
    }

    browserLauncher.intentCustomizer = {
      if (!resolvedPackage.isNullOrBlank()) {
        setPackage(resolvedPackage)
      }
    }
  }

  /**
   * Launch a browser session and resolve to success/cancel, or reject on error.
   */
  @JvmStatic
  fun open(url: String, options: ReadableMap, promise: Promise) {
    val redirectUri = if (options.hasKey("redirectUri")) {
      options.getString("redirectUri")
    } else {
      null
    }

    scope.launch {
      val result = try {
        val resolvedRedirectUri = redirectUri?.toUri() ?: browserLauncher.redirectUri
        browserLauncher.launch(URL(url), resolvedRedirectUri)
      } catch (e: Exception) {
        Result.failure(e)
      }

      if (result.isSuccess) {
        val uri = result.getOrNull()
        if (uri == null) {
          val payload = mapFactory()
          payload.putString("type", "cancel")
          promise.resolve(payload)
          return@launch
        }

        val payload = mapFactory()
        payload.putString("type", "success")
        payload.putString("url", uri.toString())
        promise.resolve(payload)
        return@launch
      }

      val error = result.exceptionOrNull()
      if (error is BrowserCanceledException || error is CancellationException) {
        val payload = mapFactory()
        payload.putString("type", "cancel")
        promise.resolve(payload)
        return@launch
      }

      // Map native errors to the shared JS contract from RNPingCore.
      val mappedError = when (error) {
        is MalformedURLException -> GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = BrowserErrorCodes.BROWSER_OPEN_ERROR,
          message = error.message
        )
        else -> GenericError(
          type = ErrorType.INTERNAL_ERROR,
          error = BrowserErrorCodes.BROWSER_OPEN_ERROR,
          message = error?.message
        )
      }
      promise.reject(mappedError, error)
    }
  }

  /**
   * Reset any in-flight browser session (no-op on Android).
   */
  @JvmStatic
  fun reset() {
    // Android BrowserLauncher does not expose a public reset API.
  }

  /**
   * Validate whether the target browser package is installed.
   */
  private fun isPackageInstalled(packageName: String): Boolean {
    return try {
      val pm = appContext?.packageManager ?: return false
      pm.getPackageInfo(packageName, 0)
      true
    } catch (e: Exception) {
      false
    }
  }

  /**
   * Invoke Auth Tab builder APIs via reflection to avoid hard dependency on newer APIs.
   */
  private fun invokeAuthTabBuilderMethod(target: Any, name: String, vararg args: Any) {
    val method = target.javaClass.methods.firstOrNull {
      it.name == name && it.parameterTypes.size == args.size
    }
    if (method == null) {
      return
    }
    try {
      method.invoke(target, *args)
    } catch (e: Exception) {
    }
  }
}
