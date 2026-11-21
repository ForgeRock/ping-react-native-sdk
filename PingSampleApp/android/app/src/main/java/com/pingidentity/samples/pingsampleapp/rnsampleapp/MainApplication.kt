/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnsampleapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.google.firebase.FirebaseApp
import com.pingidentity.rnexternalidp.RNPingExternalIdpCommon

/**
 * Application entry point for the React Native sample app.
 */
class MainApplication : Application(), ReactApplication {

  /** 
   * React Native host configuration for package registration and runtime flags.
   */
  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  /**
   * Expose the React host used by new architecture integrations.
   */
  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  /**
   * Initialize React Native when the application starts.
   */
  override fun onCreate() {
    super.onCreate()
    FirebaseApp.initializeApp(this)
    registerLineIdpHandler()
    loadReactNative(this)
  }

  /**
   * Registers the LINE IdP handler under every provider name the Journey
   * callback may carry: the AIC instance name verbatim plus, when prefixed,
   * the `react-native-`-stripped alias. The external IdP registry resolves
   * handlers by exact match on the callback's provider name, so the prefixed
   * AIC instance name in use on this tenant ("line" was already taken) must
   * be registered verbatim for resolution to succeed.
   */
  private fun registerLineIdpHandler() {
    val handler = LineIdpHandler { reactHost.currentReactContext?.currentActivity }
    val instanceName = "react-native-line"
    RNPingExternalIdpCommon.registerIdpHandler(instanceName, handler)
    stripReactNativePrefix(instanceName)?.let { alias ->
      RNPingExternalIdpCommon.registerIdpHandler(alias, handler)
    }
  }

  /**
   * Strips the `react-native-` prefix from an IdP provider name.
   *
   * @param providerName Provider name from the AIC IdP instance.
   * @return The name without the prefix, or null when the name carries no
   * prefix or nothing remains after stripping.
   */
  private fun stripReactNativePrefix(providerName: String): String? {
    val prefix = "react-native-"
    return providerName.removePrefix(prefix).takeIf {
      it != providerName && it.isNotBlank()
    }
  }
}
