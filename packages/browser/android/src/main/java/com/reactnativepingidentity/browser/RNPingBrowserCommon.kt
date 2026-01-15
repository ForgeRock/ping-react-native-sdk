package com.reactnativepingidentity.browser

import androidx.core.net.toUri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.browser.BrowserLauncher
import java.net.URL
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

object RNPingBrowserCommon {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  @JvmStatic
  fun open(url: String, options: ReadableMap, promise: Promise) {
    val redirectUri = if (options.hasKey("redirectUri")) {
      options.getString("redirectUri")
    } else {
      null
    }

    scope.launch {
      val result = try {
        val resolvedRedirectUri = redirectUri?.toUri() ?: BrowserLauncher.redirectUri
        BrowserLauncher.launch(URL(url), resolvedRedirectUri)
      } catch (e: Exception) {
        Result.failure(e)
      }

      if (result.isSuccess) {
        val uri = result.getOrNull()
        if (uri == null) {
          val payload = Arguments.createMap()
          payload.putString("type", "cancel")
          promise.resolve(payload)
          return@launch
        }

        val payload = Arguments.createMap()
        payload.putString("type", "success")
        payload.putString("url", uri.toString())
        promise.resolve(payload)
        return@launch
      }

      val error = result.exceptionOrNull()
      if (error is BrowserCanceledException || error is CancellationException) {
        val payload = Arguments.createMap()
        payload.putString("type", "cancel")
        promise.resolve(payload)
        return@launch
      }

      promise.reject("OPEN_ERROR", error?.message, error)
    }
  }
}
