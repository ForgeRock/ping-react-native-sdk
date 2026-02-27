/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.browser

import android.app.Application
import android.content.Intent
import android.content.pm.PackageInfo
import android.graphics.Color
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.pingidentity.browser.BrowserCanceledException
import io.mockk.every
import io.mockk.mockk
import io.mockk.unmockkAll
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
@OptIn(ExperimentalCoroutinesApi::class)
class RNPingBrowserCommonTest {

  private lateinit var reactContext: ReactApplicationContext
  private val mainDispatcher = StandardTestDispatcher()
  private lateinit var fakeLauncher: FakeBrowserLauncher

  @Before
  fun setUp() {
    val app = ApplicationProvider.getApplicationContext<Application>()
    reactContext = mockk(relaxed = true)
    every { reactContext.packageManager } returns app.packageManager
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    fakeLauncher = FakeBrowserLauncher()
    RNPingBrowserCommon.browserLauncher = fakeLauncher
    RNPingBrowserCommon.mapFactory = { JavaOnlyMap() }
    Dispatchers.setMain(mainDispatcher)
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
    RNPingBrowserCommon.browserLauncher = DefaultBrowserLauncherAdapter
    RNPingBrowserCommon.mapFactory = { JavaOnlyMap() }
    unmockkStatic(Arguments::class)
    unmockkAll()
  }

  @Test
  fun configureSetsIntentPackageWhenInstalled() {
    val app = ApplicationProvider.getApplicationContext<Application>()
    @Suppress("DEPRECATION")
    shadowOf(app.packageManager).addPackage(
      PackageInfo().apply { packageName = "com.example.browser" }
    )

    val config = JavaOnlyMap().apply {
      putString("browserPackage", "com.example.browser")
    }

    RNPingBrowserCommon.configure(config, reactContext)

    val intent = Intent()
    fakeLauncher.intentCustomizer(intent)

    assertEquals("com.example.browser", intent.`package`)
  }

  @Test
  fun configureIgnoresMissingBrowserPackage() {
    val config = JavaOnlyMap().apply {
      putString("browserPackage", "com.example.missing")
    }

    RNPingBrowserCommon.configure(config, reactContext)

    val intent = Intent()
    fakeLauncher.intentCustomizer(intent)

    assertNull(intent.`package`)
  }

  @Test
  fun configureIgnoresBlankBrowserPackage() {
    val config = JavaOnlyMap().apply {
      putString("browserPackage", "")
    }

    RNPingBrowserCommon.configure(config, reactContext)

    val intent = Intent()
    fakeLauncher.intentCustomizer(intent)

    assertNull(intent.`package`)
  }

  @Test
  fun configureAppliesCustomTabsColors() {
    val customTabs = JavaOnlyMap().apply {
      putString("toolbarColor", "#112233")
      putString("colorScheme", "dark")
    }
    val config = JavaOnlyMap().apply {
      putMap("customTabs", customTabs)
    }

    RNPingBrowserCommon.configure(config, reactContext)

    val builder = CustomTabsIntent.Builder()
    fakeLauncher.customTabsCustomizer(builder)
    val intent = builder.build().intent

    val scheme = intent.getIntExtra(CustomTabsIntent.EXTRA_COLOR_SCHEME, -1)

    assertEquals(CustomTabsIntent.COLOR_SCHEME_DARK, scheme)
  }

  @Test
  fun configureAuthTabsDoesNotCrash() {
    val authTabs = JavaOnlyMap().apply {
      putBoolean("ephemeral", true)
      putString("colorScheme", "light")
      putString("toolbarColor", "#334455")
      putString("navigationBarColor", "#112233")
      putString("navigationBarDividerColor", "#445566")
    }
    val config = JavaOnlyMap().apply {
      putMap("authTabs", authTabs)
    }

    RNPingBrowserCommon.configure(config, reactContext)

    val builder = AuthTabIntent.Builder()
    fakeLauncher.authTabCustomizer(builder)

    assertTrue(true)
  }

  @Test
  fun openResolvesSuccess() = runTest {
    val targetUri = Uri.parse("com.example.app://callback")
    fakeLauncher.launchResult = Result.success(targetUri)

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("success", promise.resolved?.getString("type"))
    assertEquals(targetUri.toString(), promise.resolved?.getString("url"))
  }

  @Test
  fun openResolvesCancelForBrowserCanceledException() = runTest {
    fakeLauncher.launchResult = Result.failure(BrowserCanceledException())

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("cancel", promise.resolved?.getString("type"))
  }

  @Test
  fun openRejectsOnFailure() = runTest {
    fakeLauncher.launchResult = Result.failure(IllegalStateException("boom"))

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals("boom", promise.rejectMessage)
  }

  @Test
  fun openUsesRedirectUriOverride() = runTest {
    val redirectUri = Uri.parse("com.example.app://custom")
    fakeLauncher.launchResult = Result.success(Uri.parse("com.example.app://callback"))

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
      putString("redirectUri", redirectUri.toString())
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("https://example.com", fakeLauncher.lastUrl?.toString())
    assertEquals(redirectUri, fakeLauncher.lastRedirectUri)
  }

  @Test
  fun openUsesBrowserLauncherRedirectUriWhenNotProvided() = runTest {
    val defaultRedirect = Uri.parse("com.example.app://default")
    fakeLauncher.redirectUri = defaultRedirect
    fakeLauncher.launchResult = Result.success(Uri.parse("com.example.app://callback"))

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals(defaultRedirect, fakeLauncher.lastRedirectUri)
  }

  @Test
  fun openRejectsWhenCallbackSchemeMissing() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap()

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals("callbackUrlScheme is required", promise.rejectMessage)
    assertEquals(0, fakeLauncher.launchCount)
  }

  @Test
  fun openRejectsWhenUrlInvalid() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("not a url", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertTrue(promise.rejectMessage?.contains("Illegal character") == true)
  }

  @Test
  fun openRejectsWhenUrlSchemeUnsupported() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("ftp://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals(
      "Unsupported URL scheme. Only HTTP and HTTPS URLs are supported.",
      promise.rejectMessage
    )
    assertEquals(0, fakeLauncher.launchCount)
  }

  @Test
  fun openRejectsWhenUrlRelative() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("/relative/path", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals(
      "Unsupported URL scheme. Only HTTP and HTTPS URLs are supported.",
      promise.rejectMessage
    )
    assertEquals(0, fakeLauncher.launchCount)
  }

  @Test
  fun openRejectsWhenUrlHostMissing() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https:///missing-host", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals("Invalid URL. Provide an absolute HTTP(S) URL with a host.", promise.rejectMessage)
    assertEquals(0, fakeLauncher.launchCount)
  }

  @Test
  fun openRejectsWhenUrlContainsUserInfo() = runTest {
    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://user:pass@example.com/path", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("BROWSER_OPEN_ERROR", promise.rejectCode)
    assertEquals("Unsupported URL format. User info is not allowed.", promise.rejectMessage)
    assertEquals(0, fakeLauncher.launchCount)
  }

  @Test
  fun openAllowsHttpUrl() = runTest {
    fakeLauncher.launchResult = Result.success(Uri.parse("com.example.app://callback"))

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("http://example.com/path?x=1", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals("success", promise.resolved?.getString("type"))
    assertEquals(1, fakeLauncher.launchCount)
  }

  @Test
  fun openDelegatesToBrowserLauncher() = runTest {
    fakeLauncher.launchResult = Result.success(Uri.parse("com.example.app://callback"))

    val promise = TestPromise()
    val options = JavaOnlyMap().apply {
      putString("callbackUrlScheme", "com.example.app")
    }

    RNPingBrowserCommon.open("https://example.com", options, promise)
    mainDispatcher.scheduler.advanceUntilIdle()

    assertEquals(1, fakeLauncher.launchCount)
  }

  private class FakeBrowserLauncher : BrowserLauncherAdapter {
    override var customTabsCustomizer: CustomTabsIntent.Builder.() -> Unit = {}
    override var authTabCustomizer: AuthTabIntent.Builder.() -> Unit = {}
    override var intentCustomizer: Intent.() -> Unit = {}
    override var redirectUri: Uri = Uri.parse("com.example.app://default")

    var launchResult: Result<Uri> = Result.success(Uri.parse("com.example.app://callback"))
    var launchCount: Int = 0
    var lastUrl: URL? = null
    var lastRedirectUri: Uri? = null

    override suspend fun launch(url: URL, redirectUri: Uri): Result<Uri> {
      launchCount += 1
      lastUrl = url
      lastRedirectUri = redirectUri
      return launchResult
    }
  }

  private class TestPromise : Promise {
    var resolved: com.facebook.react.bridge.ReadableMap? = null
    var rejectCode: String? = null
    var rejectMessage: String? = null
    var rejectError: Throwable? = null

    override fun resolve(value: Any?) {
      resolved = value as? com.facebook.react.bridge.ReadableMap
    }

    override fun reject(code: String, message: String?) {
      rejectCode = code
      rejectMessage = message
    }

    override fun reject(code: String, throwable: Throwable?) {
      rejectCode = code
      rejectError = throwable
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
    }

    override fun reject(throwable: Throwable) {
      rejectError = throwable
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      rejectError = throwable
    }

    override fun reject(code: String, userInfo: WritableMap) {
      rejectCode = code
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      rejectCode = code
      rejectError = throwable
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      rejectCode = code
      rejectMessage = message
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      rejectCode = code
      rejectMessage = message
      rejectError = throwable
    }

    @Suppress("DEPRECATION")
    override fun reject(message: String) {
      rejectMessage = message
    }
  }
}
