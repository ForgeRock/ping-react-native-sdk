/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnoath

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.pingidentity.android.ContextProvider
import com.pingidentity.logger.Logger
import com.pingidentity.mfa.commons.policy.BiometricAvailablePolicy
import com.pingidentity.mfa.commons.policy.DeviceTamperingPolicy
import com.pingidentity.mfa.commons.policy.MfaPolicyEvaluator
import com.pingidentity.mfa.oath.OathAlgorithm
import com.pingidentity.mfa.oath.OathClient
import com.pingidentity.mfa.oath.OathCredential
import com.pingidentity.mfa.oath.OathType
import com.pingidentity.mfa.oath.storage.OathStorage
import com.pingidentity.mfa.oath.storage.SQLOathStorage
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.policy.OathPolicyDescriptor
import com.pingidentity.rncore.policy.OathPolicyEvaluatorConfigHandleContract
import com.pingidentity.rncore.storage.OathStorageConfigHandleContract
import com.pingidentity.storage.sqlite.SQLiteStorageConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.seconds

/**
 * Shared Android implementation for the Ping OATH React Native module.
 *
 * @remarks
 * This object manages lifecycle-safe, JS-facing handles for native OATH clients.
 * It keeps native instances in-memory to preserve state across bridge calls and
 * ensures promise rejections map to the shared [GenericError] contract.
 *
 * Each [ClientEntry] co-locates the [OathClient] and its [Mutex] in a single registry
 * value so that a single [ConcurrentHashMap.get] or [ConcurrentHashMap.remove] retrieves
 * both atomically — eliminating the window where a caller could hold a client reference
 * but find no mutex and proceed unlocked.
 *
 * All native client calls (including reads) run under [ClientEntry.mutex] because
 * [OathClient] operations mutate the credential cache and underlying SQLite storage.
 */
object RNPingOathCommon {

  /** Scope for all async work dispatched by the bridge. */
  private var scopeJob = SupervisorJob()
  private var scope = CoroutineScope(scopeJob + Dispatchers.IO)

  /**
   * A registry entry holding a native OATH client and its associated serialisation mutex.
   *
   * @property client The native [OathClient] instance.
   * @property mutex The [Mutex] that serialises all bridge calls against this client.
   */
  private data class ClientEntry(val client: OathClient, val mutex: Mutex)

  /** Registry mapping JS-facing UUID handles to native [ClientEntry] instances. */
  private val registry = ConcurrentHashMap<String, ClientEntry>()

  /**
   * Ensure the native Ping SDK is initialised with the application context.
   *
   * @param reactContext React application context from the module instance.
   */
  @JvmStatic
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
  }

  /**
   * Cancel all in-flight coroutines, recreate the coroutine scope, and clear all native clients.
   *
   * @remarks
   * Invoked when the React Native bridge is invalidated to prevent leaking native instances
   * across hot reloads.
   */
  @JvmStatic
  fun cleanup() {
    scopeJob.cancel()
    scopeJob = SupervisorJob()
    scope = CoroutineScope(scopeJob + Dispatchers.IO)
    registry.clear()
  }

  /**
   * Resolve a native [Logger] from the shared Core logger registry.
   *
   * @param id Logger handle identifier from JS, or `null` when no logger was provided.
   * @return Native [Logger] instance, or `null` when [id] is blank or unregistered.
   */
  private fun resolveLoggerFromCore(id: String?): Logger? {
    if (id.isNullOrBlank()) {
      return null
    }
    val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }

  /**
   * Create a new native OATH client and store it in the registry.
   *
   * @param config JS-provided configuration map. Consumes `loggerId`, `timeout` (seconds),
   *   `enableCredentialCache`, `storageId`, and `policyEvaluatorId`. The iOS-only
   *   `encryptionEnabled` key is dropped by the JS layer on Android and never reaches this bridge.
   *   See [OathClientConfig] in the JS package for field semantics.
   * @param promise Bridge promise resolved with a UUID handle string or rejected with [GenericError].
   */
  fun create(config: ReadableMap, promise: Promise) {
    scope.launch {
      try {
        val storageId = if (config.hasKey("storageId") && !config.isNull("storageId")) {
          config.getString("storageId")
        } else null

        val resolvedStorage: OathStorage? = if (storageId != null) {
          val handle = CoreRuntime.oathStorageConfigRegistry.resolve(storageId) as? OathStorageConfigHandleContract
            ?: run {
              promise.reject(
                GenericError(
                  type = ErrorType.ARGUMENT_ERROR,
                  error = OathErrorCodes.OATH_INITIALIZATION_FAILED,
                  message = "Unresolvable storageId: $storageId"
                )
              )
              return@launch
            }
          SQLOathStorage(SQLiteStorageConfig().apply { handle.databaseName?.let { databaseName = it } })
        } else null

        val loggerId = if (config.hasKey("loggerId") && !config.isNull("loggerId")) {
          config.getString("loggerId")
        } else null
        val resolvedLogger = resolveLoggerFromCore(loggerId)

        val policyEvaluatorId = if (config.hasKey("policyEvaluatorId") && !config.isNull("policyEvaluatorId")) {
          config.getString("policyEvaluatorId")
        } else null

        // Resolve the policy evaluator descriptor from the registry and build a native
        // MfaPolicyEvaluator. When the descriptor's loggerId is null, the evaluator
        // inherits the logger resolved from OathClientConfig.loggerId (logger inheritance).
        // Unresolvable ids are rejected eagerly — passing a stale handle is a caller mistake.
        val resolvedPolicyEvaluator: MfaPolicyEvaluator? = if (policyEvaluatorId != null) {
          val descriptor = CoreRuntime.oathPolicyEvaluatorRegistry.resolve(policyEvaluatorId)
            as? OathPolicyEvaluatorConfigHandleContract
            ?: run {
              promise.reject(
                GenericError(
                  type = ErrorType.ARGUMENT_ERROR,
                  error = OathErrorCodes.OATH_INITIALIZATION_FAILED,
                  message = "Unresolvable policyEvaluatorId: $policyEvaluatorId"
                )
              )
              return@launch
            }
          // When the descriptor carries a loggerId, use that logger for the evaluator.
          // Otherwise fall back to the logger resolved from OathClientConfig.loggerId.
          val evaluatorLogger = resolveLoggerFromCore(descriptor.loggerId) ?: resolvedLogger
          val nativePolicies = descriptor.policies.map { policy ->
            when (policy) {
              is OathPolicyDescriptor.BiometricAvailable -> BiometricAvailablePolicy
              is OathPolicyDescriptor.DeviceTampering -> DeviceTamperingPolicy
            }
          }
          MfaPolicyEvaluator { policies = nativePolicies; evaluatorLogger?.let { logger = it } }
        } else null

        // RN bridges JS numbers as Double. We read via getDouble() then narrow to
        // Long: this intentionally truncates fractional seconds (JS callers
        // are expected to pass integer seconds — fractional seconds have no meaningful
        // mapping to kotlin.time.Duration's second unit).
        val timeoutSeconds: Long? = if (config.hasKey("timeout") && !config.isNull("timeout")) {
          config.getDouble("timeout").toLong()
        } else null

        val enableCredentialCacheValue: Boolean? = if (
          config.hasKey("enableCredentialCache") && !config.isNull("enableCredentialCache")
        ) {
          config.getBoolean("enableCredentialCache")
        } else null

        // Note: encryptionEnabled is iOS-only. The JS layer (createOathClient) drops
        // it on Android via Platform.OS === 'ios', so the key never arrives here.
        // Do NOT read it — see KDoc on OathClientConfig.encryptionEnabled.

        val client = OathClient {
          // timeout and enableCredentialCache are inherited from MfaConfiguration
          // (the base class of OathConfiguration). They are valid assignments here
          // even though OathConfiguration.kt only declares `storage` and
          // `policyEvaluator` directly.
          resolvedLogger?.let { logger = it }
          timeoutSeconds?.let { timeout = it.seconds }
          enableCredentialCacheValue?.let { enableCredentialCache = it }
          resolvedStorage?.let { storage = it }
          resolvedPolicyEvaluator?.let { policyEvaluator = it }
        }
        val handle = UUID.randomUUID().toString()
        registry[handle] = ClientEntry(client, Mutex())
        promise.resolve(handle)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_INITIALIZATION_FAILED), e)
      }
    }
  }

  /**
   * Parse an otpauth:// or mfauth:// URI and persist the resulting credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param uri The URI string to parse and register.
   * @param promise Bridge promise resolved with the encoded [OathCredential] map or rejected
   *   with [GenericError].
   */
  fun addCredentialFromUri(handle: String, uri: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val credential = entry.mutex.withLock {
          entry.client.addCredentialFromUri(uri).getOrThrow()
        }
        promise.resolve(encodeCredential(credential))
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_INVALID_URI), e)
      }
    }
  }

  /**
   * Retrieve a single credential by its ID.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential to retrieve.
   * @param promise Bridge promise resolved with the encoded credential map (or `null` if not found)
   *   or rejected with [GenericError].
   */
  fun getCredential(handle: String, credentialId: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val credential = entry.mutex.withLock {
          entry.client.getCredential(credentialId).getOrThrow()
        }
        if (credential != null) {
          promise.resolve(encodeCredential(credential))
        } else {
          promise.resolve(null)
        }
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND), e)
      }
    }
  }

  /**
   * Retrieve all stored credentials.
   *
   * @param handle The UUID handle returned by [create].
   * @param promise Bridge promise resolved with a [com.facebook.react.bridge.WritableArray] of
   *   encoded credential maps or rejected with [GenericError].
   */
  fun getCredentials(handle: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val credentials = entry.mutex.withLock {
          entry.client.getCredentials().getOrThrow()
        }
        val array = Arguments.createArray()
        for (c in credentials) {
          array.pushMap(encodeCredential(c))
        }
        promise.resolve(array)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_UNKNOWN_ERROR), e)
      }
    }
  }

  /**
   * Persist an updated credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param credential The credential fields as a JS map. Must include `issuer` and `accountName`.
   *   The `secret` field is never sent by JS callers; [decodeCredential] falls back to an empty
   *   string because the credential's secret is already stored natively.
   * @param promise Bridge promise resolved with the saved credential map or rejected with [GenericError].
   */
  fun saveCredential(handle: String, credential: ReadableMap, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val oathCredential = decodeCredential(credential)
        val saved = entry.mutex.withLock {
          entry.client.saveCredential(oathCredential).getOrThrow()
        }
        promise.resolve(encodeCredential(saved))
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND), e)
      }
    }
  }

  /**
   * Delete a credential by its ID.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential to delete.
   * @param promise Bridge promise resolved with `true` on success or rejected with [GenericError].
   */
  fun deleteCredential(handle: String, credentialId: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val deleted = entry.mutex.withLock {
          entry.client.deleteCredential(credentialId).getOrThrow()
        }
        promise.resolve(deleted)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND), e)
      }
    }
  }

  /**
   * Generate a one-time password code for a credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential.
   * @param promise Bridge promise resolved with the OTP code string or rejected with [GenericError].
   */
  fun generateCode(handle: String, credentialId: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val code = entry.mutex.withLock {
          entry.client.generateCode(credentialId).getOrThrow()
        }
        promise.resolve(code)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_CODE_GENERATION_FAILED), e)
      }
    }
  }

  /**
   * Generate a one-time password code along with validity information.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential.
   * @param promise Bridge promise resolved with an encoded code-info map (fields: `code`,
   *   `timeRemaining`, `counter`, `progress`, `totalPeriod`) or rejected with [GenericError].
   */
  fun generateCodeWithValidity(handle: String, credentialId: String, promise: Promise) {
    val entry = registry[handle] ?: return promise.reject(
      GenericError(
        type = ErrorType.STATE_ERROR,
        error = OathErrorCodes.OATH_STATE_ERROR,
        message = "No OATH client found for handle $handle"
      )
    )
    scope.launch {
      try {
        val codeInfo = entry.mutex.withLock {
          entry.client.generateCodeWithValidity(credentialId).getOrThrow()
        }
        val map = Arguments.createMap()
        map.putString("code", codeInfo.code)
        map.putInt("timeRemaining", codeInfo.timeRemaining)
        map.putDouble("counter", codeInfo.counter.toDouble())
        map.putDouble("progress", codeInfo.progress)
        map.putInt("totalPeriod", codeInfo.totalPeriod)
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_CODE_GENERATION_FAILED), e)
      }
    }
  }

  /**
   * Release the native client associated with [handle].
   *
   * The entry is removed from the registry first (so new lookups immediately return null), then
   * the [ClientEntry.mutex] is acquired before calling [OathClient.close] to ensure any in-flight
   * operation completes before the underlying SQLite connection is torn down.
   *
   * @param handle The UUID handle returned by [create].
   * @param promise Bridge promise resolved with `null` on success or rejected with [GenericError].
   */
  fun close(handle: String, promise: Promise) {
    val entry = registry.remove(handle) ?: return promise.resolve(null)
    scope.launch {
      try {
        entry.mutex.withLock { entry.client.close() }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject(OathErrorMapper.mapThrowable(e, OathErrorCodes.OATH_STATE_ERROR), e)
      }
    }
  }

  /**
   * Private implementation of [OathPolicyEvaluatorConfigHandleContract] stored in the registry.
   *
   * @property policies Ordered list of [OathPolicyDescriptor] values.
   * @property loggerId Optional logger handle id; `null` means inherit from [OathClientConfig].
   */
  private data class OathPolicyEvaluatorHandle(
    override val policies: List<OathPolicyDescriptor>,
    override val loggerId: String?,
  ) : OathPolicyEvaluatorConfigHandleContract

  /**
   * Register an OATH policy evaluator configuration in [CoreRuntime.oathPolicyEvaluatorRegistry].
   *
   * The `config` map must contain a `policies` array of kind strings (`"biometricAvailable"`,
   * `"deviceTampering"`). An optional `loggerId` string may be included; if absent the evaluator
   * inherits the logger resolved from [OathClientConfig.loggerId] at client creation time.
   *
   * Unrecognised policy kind strings are silently ignored at the bridge layer; validation that
   * the array is non-empty is performed in the JS facade before this is called.
   *
   * @param config Bridge map containing `policies` (ReadableArray of strings) and optionally `loggerId`.
   * @return Opaque UUID id string for the registered evaluator descriptor.
   */
  @JvmStatic
  fun registerOathPolicyEvaluator(config: ReadableMap): String {
    val rawPolicies = config.getArray("policies")
    val descriptors = mutableListOf<OathPolicyDescriptor>()
    if (rawPolicies != null) {
      for (i in 0 until rawPolicies.size()) {
        when (rawPolicies.getString(i)) {
          "biometricAvailable" -> descriptors.add(OathPolicyDescriptor.BiometricAvailable)
          "deviceTampering" -> descriptors.add(OathPolicyDescriptor.DeviceTampering)
          // Unrecognised kinds are silently skipped — JS validates before calling native.
        }
      }
    }
    val loggerId = if (config.hasKey("loggerId") && !config.isNull("loggerId")) {
      config.getString("loggerId")
    } else null

    val handle = OathPolicyEvaluatorHandle(descriptors, loggerId)
    return CoreRuntime.oathPolicyEvaluatorRegistry.register(handle)
  }

  /**
   * Retrieve a previously registered policy evaluator descriptor from
   * [CoreRuntime.oathPolicyEvaluatorRegistry] and encode it as a bridge-safe [WritableMap].
   *
   * @param id The registry id returned by [registerOathPolicyEvaluator].
   * @return A map with `policies` (array of kind strings) and optionally `loggerId`.
   */
  @JvmStatic
  fun configureOathPolicyEvaluator(id: String): WritableMap {
    val handle = CoreRuntime.oathPolicyEvaluatorRegistry.resolve(id) as? OathPolicyEvaluatorConfigHandleContract
    val map = Arguments.createMap()
    val policiesArray = Arguments.createArray()
    if (handle != null) {
      for (policy in handle.policies) {
        val kind = when (policy) {
          is OathPolicyDescriptor.BiometricAvailable -> "biometricAvailable"
          is OathPolicyDescriptor.DeviceTampering -> "deviceTampering"
        }
        policiesArray.pushString(kind)
      }
      handle.loggerId?.let { map.putString("loggerId", it) }
    }
    map.putArray("policies", policiesArray)
    return map
  }

  /**
   * Encode an [OathCredential] as a [WritableMap] for sending across the React Native bridge.
   *
   * @remarks
   * The `secret` field is intentionally excluded — it must never be sent across the bridge.
   * The `type` field uses [OathCredential.oathType]`.name` which produces uppercase strings
   * (`"TOTP"` / `"HOTP"`), consistent with the iOS implementation.
   *
   * @param c The credential to encode.
   * @return A bridge-compatible map containing all public credential fields.
   */
  private fun encodeCredential(c: OathCredential): WritableMap {
    val map = Arguments.createMap()
    map.putString("id", c.id)
    map.putString("issuer", c.issuer)
    map.putString("displayIssuer", c.displayIssuer)
    map.putString("accountName", c.accountName)
    map.putString("displayAccountName", c.displayAccountName)
    map.putString("type", c.oathType.name) // .name → uppercase TOTP/HOTP
    if (c.userId != null) map.putString("userId", c.userId) else map.putNull("userId")
    if (c.resourceId != null) map.putString("resourceId", c.resourceId) else map.putNull("resourceId")
    map.putInt("digits", c.digits)
    map.putInt("period", c.period)
    map.putDouble("counter", c.counter.toDouble()) // counter is Long; use Double for JS compatibility
    if (c.imageURL != null) map.putString("imageURL", c.imageURL) else map.putNull("imageURL")
    if (c.backgroundColor != null) map.putString("backgroundColor", c.backgroundColor) else map.putNull("backgroundColor")
    map.putBoolean("isLocked", c.isLocked)
    map.putString("algorithm", c.oathAlgorithm.name) // .name → uppercase "SHA1"/"SHA256"/"SHA512"
    map.putDouble("createdAt", c.createdAt.time.toDouble()) // ms since epoch; Double for JS compatibility
    if (c.policies != null) map.putString("policies", c.policies) else map.putNull("policies")
    if (c.lockingPolicy != null) map.putString("lockingPolicy", c.lockingPolicy) else map.putNull("lockingPolicy")
    // DO NOT include: secret
    return map
  }

  /**
   * Decode an [OathCredential] from a [ReadableMap] received from the React Native bridge.
   *
   * @remarks
   * The `secret` field is never sent by JS callers; an empty string is used as a fallback
   * because the credential's secret is already stored natively by the time this is called.
   * The `algorithm` field is decoded from its uppercase string name (e.g. `"SHA256"`) using
   * [OathAlgorithm.valueOf]; missing or unrecognised values default to [OathAlgorithm.SHA1].
   *
   * @param map The bridge map containing credential fields.
   * @return A reconstructed [OathCredential].
   * @throws IllegalArgumentException if required fields are missing or have invalid values.
   */
  private fun decodeCredential(map: ReadableMap): OathCredential {
    val id = map.getString("id") ?: UUID.randomUUID().toString()
    val issuer = requireNotNull(map.getString("issuer")) { "credential.issuer is required" }
    val accountName = requireNotNull(map.getString("accountName")) { "credential.accountName is required" }
    val displayIssuer = map.getString("displayIssuer") ?: issuer
    val displayAccountName = map.getString("displayAccountName") ?: accountName
    val typeStr = map.getString("type") ?: "TOTP"
    val oathType = OathType.fromString(typeStr)
    val algorithmStr = map.getString("algorithm") ?: "SHA1"
    val oathAlgorithm = runCatching { OathAlgorithm.valueOf(algorithmStr) }.getOrDefault(OathAlgorithm.SHA1)
    val secret = map.getString("secret") ?: ""
    val digits = if (map.hasKey("digits")) map.getInt("digits") else 6
    val period = if (map.hasKey("period")) map.getInt("period") else 30
    val counter = if (map.hasKey("counter")) map.getDouble("counter").toLong() else 0L
    val userId = if (map.hasKey("userId")) map.getString("userId") else null
    val resourceId = if (map.hasKey("resourceId")) map.getString("resourceId") else null
    val imageURL = if (map.hasKey("imageURL")) map.getString("imageURL") else null
    val backgroundColor = if (map.hasKey("backgroundColor")) map.getString("backgroundColor") else null
    val isLocked = if (map.hasKey("isLocked")) map.getBoolean("isLocked") else false

    return OathCredential(
      id = id,
      userId = userId,
      resourceId = resourceId,
      issuer = issuer,
      displayIssuer = displayIssuer,
      accountName = accountName,
      displayAccountName = displayAccountName,
      oathType = oathType,
      oathAlgorithm = oathAlgorithm,
      secret = secret,
      digits = digits,
      period = period,
      counter = counter,
      imageURL = imageURL,
      backgroundColor = backgroundColor,
      isLocked = isLocked
    )
  }
}
