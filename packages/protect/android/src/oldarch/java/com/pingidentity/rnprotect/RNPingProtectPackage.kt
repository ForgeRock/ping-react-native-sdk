/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

/**
 * Registers the Protect classic module package for Old Architecture builds.
 */
class RNPingProtectPackage : BaseReactPackage() {
  /**
   * Creates the module instance when React Native requests it by name.
   *
   * @param name Requested module name.
   * @param reactContext React application context.
   * @return Protect classic module instance when the name matches, otherwise null.
   */
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == RNPingProtectClassicModule.NAME) {
      RNPingProtectClassicModule(reactContext)
    } else {
      null
    }
  }

  /**
   * Describes module metadata used by the React Native runtime.
   *
   * @return Provider for Protect classic module info.
   */
  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos[RNPingProtectClassicModule.NAME] = ReactModuleInfo(
        RNPingProtectClassicModule.NAME,
        RNPingProtectClassicModule.NAME,
        false,
        false,
        false,
        false,
      )
      moduleInfos
    }
  }
}
