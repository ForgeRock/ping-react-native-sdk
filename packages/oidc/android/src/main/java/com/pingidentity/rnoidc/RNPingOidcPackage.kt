/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

/**
 * React Native package for the Ping OIDC module.
 *
 * @remarks
 * This package chooses between the TurboModule and classic module
 * implementations based on the new-architecture flag.
 */
class RNPingOidcPackage : BaseReactPackage() {

  /**
   * Detect whether the new architecture is enabled at build time.
   *
   * @return True when the build enables the TurboModule architecture
   */
  private val isNewArchEnabled: Boolean
    get() {
      val flag = System.getProperty("newArchEnabled") ?: "false"
      return flag.equals("true", ignoreCase = true)
    }

  /**
   * Provide the correct module implementation for the current architecture.
   *
   * @param name React Native module name
   * @param reactContext React application context
   * @return The appropriate module instance or null when not applicable
   */
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      RNPingOidcModule.NAME -> {
        if (isNewArchEnabled) {
          RNPingOidcModule(reactContext)
        } else {
          null
        }
      }
      RNPingOidcClassicModule.NAME -> {
        if (isNewArchEnabled) {
          null
        } else {
          RNPingOidcClassicModule(reactContext)
        }
      }
      else -> null
    }
  }

  /**
   * Register module metadata for React Native.
   *
   * @return Provider for module metadata
   */
  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurbo = isNewArchEnabled
      val moduleName =
        if (isTurbo) RNPingOidcModule.NAME else RNPingOidcClassicModule.NAME

      moduleInfos[moduleName] = ReactModuleInfo(
        moduleName,
        moduleName,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        isTurbo // isTurboModule
      )
      moduleInfos
    }
  }
}
