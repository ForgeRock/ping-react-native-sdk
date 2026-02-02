/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.browser.BrowserCanceledException
import com.pingidentity.oidc.OidcClient
import com.pingidentity.oidc.OidcError
import com.pingidentity.oidc.OidcUser
import com.pingidentity.oidc.OidcWeb
import com.pingidentity.oidc.Token
import com.pingidentity.oidc.User
import com.pingidentity.utils.Result
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.registry.NativeHandle
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.resetMain
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.annotation.Config
import org.robolectric.RobolectricTestRunner
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], shadows = [ShadowOidcCommonArguments::class])
class RNPingOidcCommonTest {

  private val dispatcher = StandardTestDispatcher()
  private val scope = TestScope(dispatcher)

  @Before
  fun setUp() {
    Dispatchers.setMain(dispatcher)
    CoreRuntime.oidcClientRegistry.removeAll()
    CoreRuntime.oidcWebClientRegistry.removeAll()
  }

  @After
  fun tearDown() {
    CoreRuntime.oidcClientRegistry.removeAll()
    CoreRuntime.oidcWebClientRegistry.removeAll()
    Dispatchers.resetMain()
  }

  @Test
  fun createWebClient_unknownIdThrows() {
    val error = kotlin.runCatching { RNPingOidcCommon.createWebClient("missing") }.exceptionOrNull()
    assertTrue(error is IllegalArgumentException)
  }

  @Test
  fun clientToken_unknownIdRejectsStateError() = scope.runTest {
    val promise = TestPromise()

    RNPingOidcCommon.clientToken("missing", promise)

    val map = captureReject(promise)
    assertEquals("state_error", map.getString("type"))
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, map.getString("error"))
    assertTrue(map.hasKey("message"))
  }

  @Test
  fun clientToken_successResolvesTokens() = scope.runTest {
    val clientId = registerClientHandle(
      payload = payload(),
      client = mockk(),
      user = mockk<OidcUser>().also {
        coEvery { it.token() } returns Result.Success(Token(accessToken = "access", expiresIn = 10))
      }
    )
    val promise = TestPromise()

    RNPingOidcCommon.clientToken(clientId, promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise)
    assertTrue((resolved as ReadableMap).hasKey("accessToken"))
  }

  @Test
  fun clientToken_failureRejectsMappedError() = scope.runTest {
    val clientId = registerClientHandle(
      payload = payload(),
      client = mockk(),
      user = mockk<OidcUser>().also {
        coEvery { it.token() } returns Result.Failure(OidcError.NetworkError(Exception("offline")))
      }
    )
    val promise = TestPromise()

    RNPingOidcCommon.clientToken(clientId, promise)
    advanceUntilIdle()

    val map = captureReject(promise)
    assertEquals("network_error", map.getString("type"))
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, map.getString("error"))
  }

  @Test
  fun clientRefresh_successResolvesTokens() = scope.runTest {
    val clientId = registerClientHandle(
      payload = payload(),
      client = mockk(),
      user = mockk<OidcUser>().also {
        coEvery { it.refresh() } returns Result.Success(Token(accessToken = "access", expiresIn = 10))
      }
    )
    val promise = TestPromise()

    RNPingOidcCommon.clientRefresh(clientId, promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise)
    assertTrue((resolved as ReadableMap).hasKey("accessToken"))
  }

  @Test
  fun clientUserinfo_successResolvesUserinfo() = scope.runTest {
    val clientId = registerClientHandle(
      payload = payload(),
      client = mockk(),
      user = mockk<OidcUser>().also {
        coEvery { it.userinfo(true) } returns Result.Success(
          JsonObject(mapOf("name" to JsonPrimitive("Jane")))
        )
      }
    )
    val promise = TestPromise()

    RNPingOidcCommon.clientUserinfo(clientId, true, promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise)
    assertEquals("Jane", (resolved as ReadableMap).getString("name"))
  }

  @Test
  fun clientRevoke_successResolvesNull() = scope.runTest {
    val clientId = registerClientHandle(
      payload = payload(),
      client = mockk(),
      user = mockk<OidcUser>().also {
        coEvery { it.revoke() } returns Unit
      }
    )
    val promise = TestPromise()

    RNPingOidcCommon.clientRevoke(clientId, promise)
    advanceUntilIdle()

    assertEquals(null, promise.resolvedValue)
  }

  @Test
  fun clientEndSession_successResolvesBoolean() = scope.runTest {
    val client = mockk<OidcClient>()
    coEvery { client.endSession() } returns true
    val clientId = registerClientHandle(payload(), client, mockk())
    val promise = TestPromise()

    RNPingOidcCommon.clientEndSession(clientId, promise)
    advanceUntilIdle()

    assertEquals(true, promise.resolvedValue)
  }

  @Test
  fun authorize_successResolvesSuccess() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.authorize(any()) } returns kotlin.Result.success(mockk())
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.authorize(webId, JavaOnlyMap(), promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise) as ReadableMap
    assertEquals("success", resolved.getString("type"))
  }

  @Test
  fun authorize_canceledExceptionResolvesCancel() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.authorize(any()) } throws BrowserCanceledException()
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.authorize(webId, JavaOnlyMap(), promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise) as ReadableMap
    assertEquals("cancel", resolved.getString("type"))
  }

  @Test
  fun authorize_failureResolvesCancelWhenCanceled() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.authorize(any()) } returns kotlin.Result.failure(BrowserCanceledException())
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.authorize(webId, JavaOnlyMap(), promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise) as ReadableMap
    assertEquals("cancel", resolved.getString("type"))
  }

  @Test
  fun authorize_failureRejects() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.authorize(any()) } returns kotlin.Result.failure(IllegalStateException("failed"))
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.authorize(webId, JavaOnlyMap(), promise)
    advanceUntilIdle()

    val map = captureReject(promise)
    assertEquals(OidcErrorCodes.OIDC_AUTHORIZE_ERROR, map.getString("error"))
  }

  @Test
  fun hasUser_returnsFalseWhenMissing() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns null
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.hasUser(webId, promise)
    advanceUntilIdle()

    assertEquals(false, promise.resolvedValue)
  }

  @Test
  fun hasUser_returnsTrueWhenPresent() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns mockk()
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.hasUser(webId, promise)
    advanceUntilIdle()

    assertEquals(true, promise.resolvedValue)
  }

  @Test
  fun token_rejectsWhenUserMissing() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns null
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.token(webId, promise)
    advanceUntilIdle()

    val map = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, map.getString("type"))
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, map.getString("error"))
    assertTrue(map.hasKey("message"))
  }

  @Test
  fun userinfo_successResolvesUserinfo() = scope.runTest {
    val user = mockk<User>()
    coEvery { user.userinfo(true) } returns Result.Success(
      JsonObject(mapOf("email" to JsonPrimitive("user@example.com")))
    )
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns user
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.userinfo(webId, true, promise)
    advanceUntilIdle()

    val resolved = captureResolve(promise) as ReadableMap
    assertEquals("user@example.com", resolved.getString("email"))
  }

  @Test
  fun revoke_rejectsWhenUserMissing() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns null
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.revoke(webId, promise)
    advanceUntilIdle()

    val map = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, map.getString("type"))
    assertEquals(OidcErrorCodes.OIDC_REVOKE_ERROR, map.getString("error"))
    assertTrue(map.hasKey("message"))
  }

  @Test
  fun logout_rejectsWhenUserMissing() = scope.runTest {
    val web = mockk<OidcWeb>()
    coEvery { web.user() } returns null
    val webId = registerWebHandle("client-1", web)
    val promise = TestPromise()

    RNPingOidcCommon.logout(webId, promise)
    advanceUntilIdle()

    val map = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, map.getString("type"))
    assertEquals(OidcErrorCodes.OIDC_LOGOUT_ERROR, map.getString("error"))
    assertTrue(map.hasKey("message"))
  }

  private fun payload(): OidcClientPayload {
    return OidcClientPayload(
      clientId = "client-id",
      discoveryEndpoint = "https://example.com/.well-known/openid-configuration",
      openId = null,
      redirectUri = "com.example.app://callback",
      scopes = listOf("openid"),
      storageId = null,
      loggerId = null,
      acrValues = null,
      signOutRedirectUri = null,
      state = null,
      nonce = null,
      uiLocales = null,
      refreshThreshold = null,
      loginHint = null,
      display = null,
      prompt = null,
      additionalParameters = emptyMap()
    )
  }

  private fun registerClientHandle(
    payload: OidcClientPayload,
    client: OidcClient,
    user: OidcUser
  ): String {
    val handle = newClientHandle(payload, client, user)
    return CoreRuntime.oidcClientRegistry.register(handle)
  }

  private fun registerWebHandle(clientId: String, web: OidcWeb): String {
    val handle = newWebHandle(clientId, web)
    return CoreRuntime.oidcWebClientRegistry.register(handle)
  }

  private fun newClientHandle(
    payload: OidcClientPayload,
    client: OidcClient,
    user: OidcUser
  ): NativeHandle {
    val clazz = Class.forName("com.pingidentity.rnoidc.RNPingOidcCommon\$OidcClientHandle")
    val ctor = clazz.getDeclaredConstructor(
      OidcClientPayload::class.java,
      OidcClient::class.java,
      OidcUser::class.java
    )
    ctor.isAccessible = true
    return ctor.newInstance(payload, client, user) as NativeHandle
  }

  private fun newWebHandle(clientId: String, web: OidcWeb): NativeHandle {
    val clazz = Class.forName("com.pingidentity.rnoidc.RNPingOidcCommon\$OidcWebHandle")
    val ctor = clazz.getDeclaredConstructor(String::class.java, OidcWeb::class.java)
    ctor.isAccessible = true
    return ctor.newInstance(clientId, web) as NativeHandle
  }

  private fun captureResolve(promise: TestPromise): Any? = promise.resolvedValue

  private fun captureReject(promise: TestPromise): WritableMap {
    return promise.rejectUserInfo ?: JavaOnlyMap()
  }
}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowOidcCommonArguments {
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = JavaOnlyArray()
}

private class TestPromise : com.facebook.react.bridge.Promise {
  var resolvedValue: Any? = null
  var rejectCode: String? = null
  var rejectMessage: String? = null
  var rejectThrowable: Throwable? = null
  var rejectUserInfo: WritableMap? = null

  override fun resolve(value: Any?) {
    resolvedValue = value
  }

  override fun reject(code: String, message: String?) {
    rejectCode = code
    rejectMessage = message
  }

  override fun reject(code: String, throwable: Throwable?) {
    rejectCode = code
    rejectThrowable = throwable
  }

  override fun reject(code: String, message: String?, throwable: Throwable?) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
  }

  override fun reject(throwable: Throwable) {
    rejectThrowable = throwable
  }

  override fun reject(throwable: Throwable, userInfo: WritableMap) {
    rejectThrowable = throwable
    rejectUserInfo = userInfo
  }

  override fun reject(code: String, userInfo: WritableMap) {
    rejectCode = code
    rejectUserInfo = userInfo
  }

  override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
    rejectCode = code
    rejectThrowable = throwable
    rejectUserInfo = userInfo
  }

  override fun reject(code: String, message: String?, userInfo: WritableMap) {
    rejectCode = code
    rejectMessage = message
    rejectUserInfo = userInfo
  }

  override fun reject(code: String?, message: String?, throwable: Throwable?, userInfo: WritableMap?) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
    rejectUserInfo = userInfo
  }

  @Deprecated(
    message = "Prefer passing a module-specific error code to JS. Using this method will pass the error code EUNSPECIFIED",
    replaceWith = ReplaceWith("reject(code, message)")
  )
  override fun reject(message: String) {
    rejectMessage = message
  }
}
