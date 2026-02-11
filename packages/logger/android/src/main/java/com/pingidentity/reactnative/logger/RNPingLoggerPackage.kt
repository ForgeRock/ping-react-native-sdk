/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
package com.pingidentity.reactnative.logger

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

/**
 * React Native package that provides the PingLogger module.
 * Automatically selects between Turbo Module (New Architecture) and Classic module
 * based on the runtime configuration.
 */
class LoggerPackage : BaseReactPackage() {
  /**
   * Detects whether the New Architecture is enabled.
   *
   * @return true if the New Architecture is enabled, false otherwise
   */
  private val isNewArchEnabled: Boolean
    get() {
      val flag = System.getProperty("newArchEnabled") ?: "false"
      return flag.equals("true", ignoreCase = true)
    }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == RNPingLoggerModule.NAME) {
      if (isNewArchEnabled) {
        // --- Turbo path ---
        RNPingLoggerModule(reactContext)
      } else {
        // --- Classic fallback ---
        RNloggerClassicModule(reactContext)
      }
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurbo = isNewArchEnabled
      moduleInfos[RNPingLoggerModule.NAME] = ReactModuleInfo(
        RNPingLoggerModule.NAME,
        RNPingLoggerModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        isTurbo // isTurboModule
      )
      moduleInfos
    }
  }
}
