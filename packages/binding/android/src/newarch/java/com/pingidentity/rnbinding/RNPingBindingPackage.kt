/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * React Native package registration for the Binding TurboModule (New Architecture).
 */
class RNPingBindingPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == RNPingBindingModule.NAME) RNPingBindingModule(reactContext) else null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos = mutableMapOf<String, ReactModuleInfo>()
      moduleInfos[RNPingBindingModule.NAME] = ReactModuleInfo(
        RNPingBindingModule.NAME,
        RNPingBindingModule.NAME,
        false,
        false,
        false,
        true
      )
      moduleInfos
    }
  }
}
