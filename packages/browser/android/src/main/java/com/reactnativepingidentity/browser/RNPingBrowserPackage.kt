package com.reactnativepingidentity.browser

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class RNPingBrowserPackage : BaseReactPackage() {

  private val isNewArchEnabled: Boolean
    get() {
      val flag = System.getProperty("newArchEnabled") ?: "false"
      return flag.equals("true", ignoreCase = true)
    }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      RNPingBrowserModule.NAME -> {
        if (isNewArchEnabled) {
          RNPingBrowserModule(reactContext)
        } else {
          null
        }
      }
      RNPingBrowserClassicModule.NAME -> {
        if (isNewArchEnabled) {
          null
        } else {
          RNPingBrowserClassicModule(reactContext)
        }
      }
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurbo = isNewArchEnabled
      val moduleName =
        if (isTurbo) RNPingBrowserModule.NAME else RNPingBrowserClassicModule.NAME

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
