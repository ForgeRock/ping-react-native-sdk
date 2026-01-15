package com.reactnativepingidentity.logger

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = LoggerModule.NAME)
class LoggerModule(reactContext: ReactApplicationContext) :
  NativeRNPingLoggerSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun registerLogger(config: ReadableMap): String {
    return RNPingLoggerCommon.configure(config)
  }

  override fun syncLogger(config: ReadableMap) {
    RNPingLoggerCommon.sync(config)
  }

  companion object {
    const val NAME = "Logger"
  }
}
