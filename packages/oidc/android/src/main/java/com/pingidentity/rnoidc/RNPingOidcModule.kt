package com.pingidentity.rnoidc

import com.facebook.react.bridge.ReactApplicationContext

class RNPingOidcModule(reactContext: ReactApplicationContext) :
  NativeRNPingOidcSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeRNPingOidcSpec.NAME
  }
}
