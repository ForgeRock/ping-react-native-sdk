package com.reactnativepingidentity.browser

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingBrowserClassicModule.NAME)
class RNPingBrowserClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "RNPingBrowserClassic"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun open(url: String, options: ReadableMap, promise: Promise) {
    RNPingBrowserCommon.open(url, options, promise)
  }
}
