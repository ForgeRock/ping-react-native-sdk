/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.pingidentity.android.ContextProvider
import com.pingidentity.device.client.BoundDevice
import com.pingidentity.device.client.Device
import com.pingidentity.device.client.DeviceClient
import com.pingidentity.device.client.DeviceRepository
import com.pingidentity.device.client.OathDevice
import com.pingidentity.device.client.ProfileDevice
import com.pingidentity.device.client.PushDevice
import com.pingidentity.device.client.WebAuthnDevice
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import com.pingidentity.rncore.utils.launchBridge
import java.net.MalformedURLException
import java.net.URI
import java.net.URISyntaxException
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Shared implementation for the Device Client React Native Android bridge.
 *
 * Maintains a handle → [DeviceClient] registry so a single app can own
 * multiple clients (one per active session, for example).
 *
 * Ancillary logic lives in sibling files:
 * - [DeviceErrorClassifier] — classifies throwables into [GenericError] rejections
 * - [DeviceJson] — encodes / decodes device payloads
 * - [DeviceClientConfigNormalizer] — tolerates sloppy `serverUrl` / `realm` input
 */
object RNPingDeviceClientCommon {

  /**
   * Coroutine scope for executing Device Client operations asynchronously on the IO dispatcher.
   *
   * Uses [SupervisorJob] so that a failure in one coroutine does not cancel siblings.
   */
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /**
   * Thread-safe handle-based registry mapping opaque string handles to live [DeviceClient]
   * instances. JS receives the handle id from [create] and passes it back on every
   * subsequent call so the bridge can look up the correct client. The handle is removed
   * when [dispose] is called.
   *
   * Kept local to this module (not promoted to `rncore`) because no other package needs
   * to resolve Device Client handles today. Revisit if a cross-module lookup use case
   * emerges, similar to the shared logger registry.
   */
  private val registry = ConcurrentHashMap<String, DeviceClient>()

  /**
   * Configure application context required by Ping native SDKs.
   *
   * @param reactContext The React Native application context.
   */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
  }

  // region  Native entry points

  /**
   * Create a new [DeviceClient] from the supplied configuration and register it
   * in the handle-based registry.
   *
   * Required config keys: `serverUrl`, `ssoToken`, `cookieName`. Optional:
   * `realm` (defaults to `"root"`).
   *
   * On success the promise resolves with the opaque handle id (UUID string)
   * that JS must pass to all subsequent operations.
   *
   * @param config React Native [ReadableMap] containing the client configuration.
   * @param promise React Native promise resolved with the handle id or rejected on validation error.
   */
  @JvmStatic
  fun create(config: ReadableMap, promise: Promise) {
    // TODO-PARITY: Android uses `ssoTokenString` while iOS uses `ssoToken`.
    val serverUrl = config.getStringOrNull("serverUrl")
    val ssoToken = config.getStringOrNull("ssoToken")
    val cookieName = config.getStringOrNull("cookieName")
    if (serverUrl.isNullOrBlank() || ssoToken.isNullOrBlank() || cookieName.isNullOrBlank()) {
      promise.reject(
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG,
          message = "serverUrl, ssoToken, and cookieName are required.",
        ),
      )
      return
    }
    val normalizedServerUrl = DeviceClientConfigNormalizer.normalizeServerUrl(serverUrl)
    val realm = DeviceClientConfigNormalizer.normalizeRealm(config.getStringOrNull("realm"))
    // Parse via URI first (pure RFC-3986 parsing, no potential network
    // resolution) and then convert to URL for the native SDK's constructor.
    // Using URL(String) directly trips CWE-676 in security scanners.
    val parsedUrl: URL = try {
      URI(normalizedServerUrl).toURL()
    } catch (e: URISyntaxException) {
      promise.reject(
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG,
          message = "Invalid serverUrl: ${e.message}",
        ),
        e,
      )
      return
    } catch (e: MalformedURLException) {
      promise.reject(
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = DeviceClientErrorCodes.DEVICE_CLIENT_MISSING_CONFIG,
          message = "Invalid serverUrl: ${e.message}",
        ),
        e,
      )
      return
    }

    val resolvedLogger = resolveLoggerFromCore(config.getStringOrNull("loggerId"))
    val client = DeviceClient {
      this.ssoTokenString = ssoToken
      this.serverUrl = parsedUrl
      this.realm = realm
      this.cookieName = cookieName
      if (resolvedLogger != null) {
        this.logger = resolvedLogger
      }
    }
    val handleId = UUID.randomUUID().toString()
    registry[handleId] = client
    promise.resolve(handleId)
  }

  /**
   * Resolve a native [Logger] from the shared core logger registry using the
   * opaque handle id emitted by `@ping-identity/rn-logger`.
   *
   * @param id Logger handle id from JS, or null when no logger was supplied.
   * @return Native logger instance, or null when missing / invalid / unsupported.
   */
  private fun resolveLoggerFromCore(id: String?): Logger? {
    if (id.isNullOrBlank()) return null
    val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }

  /**
   * Retrieve all devices of the given type from the server.
   *
   * The operation runs asynchronously on the IO dispatcher. On success the
   * promise resolves with a map containing a `result` array of encoded devices.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of [DeviceType.OATH], [DeviceType.PUSH], [DeviceType.BOUND], [DeviceType.PROFILE], or [DeviceType.WEB_AUTHN].
   * @param promise React Native promise resolved with the device list or rejected on error.
   */
  @JvmStatic
  fun get(handleId: String, deviceType: String, promise: Promise) {
    val client = registry[handleId] ?: run {
      DeviceErrorClassifier.rejectHandleNotFound(promise); return
    }
    scope.launchBridge(promise, DeviceClientErrorCodes.DEVICE_CLIENT_ERROR) {
      try {
        // TODO-PARITY: Android repo properties are suffixed with `Device` (`oathDevice`, `pushDevice`, ...)
        //   while iOS uses bare names (`oath`, `push`, ...). Pick one convention.
        // TODO-PARITY: Android uses `.devices()` while iOS uses `.get()`. Pick one convention.
        val result = when (deviceType) {
          DeviceType.OATH -> client.oathDevice.devices()
          DeviceType.PUSH -> client.pushDevice.devices()
          DeviceType.BOUND -> client.boundDevice.devices()
          DeviceType.PROFILE -> client.profileDevice.devices()
          DeviceType.WEB_AUTHN -> client.webAuthnDevice.devices()
          else -> {
            DeviceErrorClassifier.rejectInvalidType(promise, deviceType); return@launchBridge
          }
        }
        result.fold(
          onSuccess = { list ->
            val payload = Arguments.createMap()
            payload.putArray("result", DeviceJson.encodeDevices(list as List<Device>))
            promise.resolve(payload)
          },
          onFailure = { err -> DeviceErrorClassifier.rejectThrowable(promise, err) },
        )
      } catch (e: CancellationException) {
        throw e
      } catch (t: Throwable) {
        DeviceErrorClassifier.rejectThrowable(promise, t)
      }
    }
  }

  /**
   * Update a device on the server.
   *
   * The JS device payload is decoded into the appropriate native [Device]
   * subclass via [DeviceJson.decodeDevice] and forwarded to the matching
   * [DeviceRepository.update] method.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of [DeviceType.OATH], [DeviceType.PUSH], [DeviceType.BOUND], [DeviceType.PROFILE], or [DeviceType.WEB_AUTHN].
   * @param device React Native [ReadableMap] containing the updated device fields.
   * @param promise React Native promise resolved with the updated device or rejected on error.
   */
  @JvmStatic
  fun update(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    val client = registry[handleId] ?: run {
      DeviceErrorClassifier.rejectHandleNotFound(promise); return
    }
    scope.launchBridge(promise, DeviceClientErrorCodes.DEVICE_CLIENT_ERROR) {
      try {
        val decoded = DeviceJson.decodeDevice(deviceType, device)
        val result = when (deviceType) {
          DeviceType.OATH -> client.oathDevice.updateAs<OathDevice>(decoded)
          DeviceType.PUSH -> client.pushDevice.updateAs<PushDevice>(decoded)
          DeviceType.BOUND -> client.boundDevice.updateAs<BoundDevice>(decoded)
          DeviceType.PROFILE -> client.profileDevice.updateAs<ProfileDevice>(decoded)
          DeviceType.WEB_AUTHN -> client.webAuthnDevice.updateAs<WebAuthnDevice>(decoded)
          else -> {
            DeviceErrorClassifier.rejectInvalidType(promise, deviceType); return@launchBridge
          }
        }
        result.fold(
          onSuccess = { d ->
            val payload = Arguments.createMap()
            payload.putMap("result", DeviceJson.encodeDevice(d as Device))
            promise.resolve(payload)
          },
          onFailure = { err -> DeviceErrorClassifier.rejectThrowable(promise, err) },
        )
      } catch (e: CancellationException) {
        throw e
      } catch (t: Throwable) {
        DeviceErrorClassifier.rejectThrowable(promise, t)
      }
    }
  }

  /**
   * Delete a device from the server.
   *
   * The JS device payload is decoded into the appropriate native [Device]
   * subclass via [DeviceJson.decodeDevice] and forwarded to the matching
   * [DeviceRepository.delete] method.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of [DeviceType.OATH], [DeviceType.PUSH], [DeviceType.BOUND], [DeviceType.PROFILE], or [DeviceType.WEB_AUTHN].
   * @param device React Native [ReadableMap] identifying the device to delete.
   * @param promise React Native promise resolved with the deleted device or rejected on error.
   */
  @JvmStatic
  fun deleteDevice(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    val client = registry[handleId] ?: run {
      DeviceErrorClassifier.rejectHandleNotFound(promise); return
    }
    scope.launchBridge(promise, DeviceClientErrorCodes.DEVICE_CLIENT_ERROR) {
      try {
        val decoded = DeviceJson.decodeDevice(deviceType, device)
        val result = when (deviceType) {
          DeviceType.OATH -> client.oathDevice.deleteAs<OathDevice>(decoded)
          DeviceType.PUSH -> client.pushDevice.deleteAs<PushDevice>(decoded)
          DeviceType.BOUND -> client.boundDevice.deleteAs<BoundDevice>(decoded)
          DeviceType.PROFILE -> client.profileDevice.deleteAs<ProfileDevice>(decoded)
          DeviceType.WEB_AUTHN -> client.webAuthnDevice.deleteAs<WebAuthnDevice>(decoded)
          else -> {
            DeviceErrorClassifier.rejectInvalidType(promise, deviceType); return@launchBridge
          }
        }
        result.fold(
          onSuccess = { d ->
            val payload = Arguments.createMap()
            payload.putMap("result", DeviceJson.encodeDevice(d as Device))
            promise.resolve(payload)
          },
          onFailure = { err -> DeviceErrorClassifier.rejectThrowable(promise, err) },
        )
      } catch (e: CancellationException) {
        throw e
      } catch (t: Throwable) {
        DeviceErrorClassifier.rejectThrowable(promise, t)
      }
    }
  }

  /**
   * Remove a [DeviceClient] from the handle-based registry.
   *
   * After this call the handle is no longer valid and any subsequent operations
   * using it will be rejected with [DeviceClientErrorCodes.DEVICE_CLIENT_HANDLE_NOT_FOUND].
   *
   * @param handleId Opaque handle id returned by [create].
   * @param promise React Native promise resolved with null on success.
   */
  @JvmStatic
  fun dispose(handleId: String, promise: Promise) {
    registry.remove(handleId)
    promise.resolve(null)
  }

  // endregion
}

/**
 * Safely read a string from a [ReadableMap], returning null when the key is
 * absent or the value is explicitly null.
 *
 * @param key The field name to read.
 * @return The string value, or null.
 */
private fun ReadableMap.getStringOrNull(key: String): String? =
  if (hasKey(key) && !isNull(key)) getString(key) else null

/**
 * Type-erased update helper that casts the [device] to [T] before delegating
 * to [DeviceRepository.update].
 *
 * This avoids duplicating the `when`-dispatch in the caller for every device
 * type while keeping the generic [DeviceRepository] contract intact.
 *
 * @param device The device instance, expected to be of type [T].
 * @return The result of the update operation.
 */
private suspend inline fun <reified T> DeviceRepository<T>.updateAs(
  device: Any,
): Result<T> {
  require(device is T)
  return this.update(device)
}

/**
 * Type-erased delete helper that casts the [device] to [T] before delegating
 * to [DeviceRepository.delete].
 *
 * This avoids duplicating the `when`-dispatch in the caller for every device
 * type while keeping the generic [DeviceRepository] contract intact.
 *
 * @param device The device instance, expected to be of type [T].
 * @return The result of the delete operation.
 */
private suspend inline fun <reified T> DeviceRepository<T>.deleteAs(
  device: Any,
): Result<T> {
  require(device is T)
  return this.delete(device)
}
