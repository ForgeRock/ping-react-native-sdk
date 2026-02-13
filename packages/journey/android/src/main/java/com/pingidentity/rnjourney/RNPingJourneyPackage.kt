/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

/**
 * React Native package for Journey Android modules.
 */
class RNPingJourneyPackage : BaseReactPackage() {

  /**
   * Detect whether New Architecture is enabled.
   */
  private val isNewArchEnabled: Boolean
    get() {
      val flag = System.getProperty("newArchEnabled") ?: "false"
      return flag.equals("true", ignoreCase = true)
    }

  /**
   * Resolve the module implementation for the active architecture.
   */
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      RNPingJourneyModule.NAME -> {
        if (isNewArchEnabled) {
          RNPingJourneyModule(reactContext)
        } else {
          null
        }
      }
      RNPingJourneyClassicModule.NAME -> {
        if (isNewArchEnabled) {
          null
        } else {
          RNPingJourneyClassicModule(reactContext)
        }
      }
      else -> null
    }
  }

  /**
   * Register React module metadata.
   */
  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurbo = isNewArchEnabled
      val moduleName =
        if (isTurbo) RNPingJourneyModule.NAME else RNPingJourneyClassicModule.NAME

      moduleInfos[moduleName] = ReactModuleInfo(
        moduleName,
        moduleName,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        isTurbo // isTurboModule
      )
      moduleInfos
    }
  }
}
