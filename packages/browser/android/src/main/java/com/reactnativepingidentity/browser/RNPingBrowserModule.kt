package com.reactnativepingidentity.browser

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingBrowserModule.NAME)
class RNPingBrowserModule(reactContext: ReactApplicationContext) :
  NativeRNPingBrowserSpec(reactContext) {

  override fun getName(): String = NAME

  override fun open(url: String, options: ReadableMap, promise: Promise) {
    RNPingBrowserCommon.open(url, options, promise)
  }

  companion object {
    const val NAME = "RNPingBrowser"
  }
}
