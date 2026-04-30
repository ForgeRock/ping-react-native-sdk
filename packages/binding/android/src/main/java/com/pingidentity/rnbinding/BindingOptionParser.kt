/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import androidx.annotation.VisibleForTesting
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.device.binding.Prompt
import com.pingidentity.device.binding.journey.DeviceBindingConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.logger.Logger
import java.time.Instant

private const val LOGGER_ID_KEY = "loggerId"
private const val HAS_PIN_COLLECTOR_KEY = "hasPinCollector"
private const val HAS_USER_KEY_SELECTOR_KEY = "hasUserKeySelector"

/**
 * Parsed per-call runtime configuration extracted from the JS `config` argument.
 *
 * @property loggerId Optional registry ID of a logger registered via `RNPingCore`.
 * @property hasPinCollector True when the JS caller has registered a PIN collector callback.
 * @property hasUserKeySelector True when the JS caller has registered a user-key selector callback.
 * @property userKeyStorageId Optional registry ID of a user-key storage config registered via `RNPingCore`.
 */
internal data class CallConfig(
  val loggerId: String?,
  val hasPinCollector: Boolean = false,
  val hasUserKeySelector: Boolean = false,
  val userKeyStorageId: String? = null,
)

/**
 * Reads the `index` field from [options], supporting both numeric and string representations.
 * Defaults to `0` when the field is absent, null, or not parseable as an integer.
 */
internal fun parseCallbackIndex(options: ReadableMap?): Int {
  if (options == null || !options.hasKey("index") || options.isNull("index")) return 0
  return when (options.getType("index")) {
    ReadableType.Number -> options.getDouble("index").toInt()
    ReadableType.String -> options.getString("index")?.toIntOrNull() ?: 0
    else -> 0
  }
}

/**
 * Reads a trimmed, non-blank string value from [options] at [key].
 * Returns null when the key is absent, null, not a string, or blank after trimming.
 */
internal fun parseStringOption(options: ReadableMap?, key: String): String? {
  if (options == null || !options.hasKey(key) || options.isNull(key)) return null
  return when (options.getType(key)) {
    ReadableType.String -> options.getString(key)?.trim()?.takeIf { it.isNotEmpty() }
    else -> null
  }
}

/**
 * Extracts the `claims` map from [options] as a flat `Map<String, Any>`.
 * Only string, number, and boolean leaf values are included; nested maps and arrays are ignored.
 * Returns an empty map when the field is absent or not a map.
 */
internal fun parseClaims(options: ReadableMap?): Map<String, Any> {
  if (options == null || !options.hasKey("claims") || options.isNull("claims")) return emptyMap()
  if (options.getType("claims") != ReadableType.Map) return emptyMap()
  val claimsMap = options.getMap("claims") ?: return emptyMap()
  val result = mutableMapOf<String, Any>()
  val iterator = claimsMap.keySetIterator()
  while (iterator.hasNextKey()) {
    val key = iterator.nextKey()
    when (claimsMap.getType(key)) {
      ReadableType.String -> claimsMap.getString(key)?.let { result[key] = it }
      ReadableType.Number -> result[key] = claimsMap.getDouble(key)
      ReadableType.Boolean -> result[key] = claimsMap.getBoolean(key)
      else -> {}
    }
  }
  return result
}

/**
 * Parses the JS `config` argument into a [CallConfig].
 *
 * @param config The per-call configuration map passed from JS.
 * @return A [CallConfig] with all optional fields resolved.
 */
internal fun parseConfig(config: ReadableMap?): CallConfig {
  val loggerId = if (config != null && config.hasKey(LOGGER_ID_KEY) && !config.isNull(LOGGER_ID_KEY)) {
    when (config.getType(LOGGER_ID_KEY)) {
      ReadableType.String -> config.getString(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
      else -> null
    }
  } else null

  val hasPinCollector = config != null &&
    config.hasKey(HAS_PIN_COLLECTOR_KEY) &&
    !config.isNull(HAS_PIN_COLLECTOR_KEY) &&
    config.getType(HAS_PIN_COLLECTOR_KEY) == ReadableType.Boolean &&
    config.getBoolean(HAS_PIN_COLLECTOR_KEY)

  val hasUserKeySelector = config != null &&
    config.hasKey(HAS_USER_KEY_SELECTOR_KEY) &&
    !config.isNull(HAS_USER_KEY_SELECTOR_KEY) &&
    config.getType(HAS_USER_KEY_SELECTOR_KEY) == ReadableType.Boolean &&
    config.getBoolean(HAS_USER_KEY_SELECTOR_KEY)

  return CallConfig(
    loggerId = loggerId,
    hasPinCollector = hasPinCollector,
    hasUserKeySelector = hasUserKeySelector,
    userKeyStorageId = parseStringOption(config, "userKeyStorageId"),
  )
}

/**
 * Resolves a [Logger] from the `CoreRuntime` registry using [loggerId].
 * Returns null when [loggerId] is blank or no matching handle is registered.
 */
internal fun resolveLoggerFromCore(loggerId: String?): Logger? {
  if (loggerId.isNullOrBlank()) return null
  val handle = CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract ?: return null
  return handle.nativeLogger as? Logger
}

/**
 * Applies JS options (appPin, biometric, jwt) and optional user-key storage config to
 * [bindingConfig]. This mutates the config in-place inside a `bind {}` or `sign {}` block.
 *
 * @param bindingConfig The native [DeviceBindingConfig] to configure.
 * @param options The JS options map containing appPin, biometric, and jwt sub-keys.
 * @param userKeyStorageId Optional registry ID for a user-key storage config.
 */
internal fun applyCommonBindingConfig(
  bindingConfig: DeviceBindingConfig,
  options: ReadableMap?,
  userKeyStorageId: String?
) {
  userKeyStorageId?.let { id ->
    val handle = CoreRuntime.bindingUserKeyStorageConfigRegistry.resolve(id)
    val storageHandle = handle as? StorageConfigHandleContract
    if (storageHandle != null) {
      bindingConfig.userKeyStorage {
        storage {
          storageHandle.fileName?.let { fileName = it }
          storageHandle.keyAlias?.let { keyAlias = it }
          storageHandle.strongBoxPreferred?.let { strongBoxPreferred = it }
          storageHandle.cacheStrategy?.let { value -> cacheStrategy = parseCacheStrategy(value) }
        }
      }
    }
  }
  if (options == null) return

  val appPin = options.getMap("appPin")
  if (appPin != null) {
    bindingConfig.appPinConfig {
      if (appPin.hasKey("maxAttempts") && !appPin.isNull("maxAttempts")) {
        pinRetry = appPin.getDouble("maxAttempts").toInt()
      }
      parseStringOption(appPin, "keystoreType")?.let { keystoreType = it }
      val promptMap = appPin.getMap("prompt")
      if (promptMap != null) {
        val title = if (promptMap.hasKey("title") && !promptMap.isNull("title")) {
          promptMap.getString("title") ?: ""
        } else prompt.title
        val subtitle = if (promptMap.hasKey("subtitle") && !promptMap.isNull("subtitle")) {
          promptMap.getString("subtitle") ?: ""
        } else prompt.subtitle
        val description = if (promptMap.hasKey("description") && !promptMap.isNull("description")) {
          promptMap.getString("description") ?: ""
        } else prompt.description
        prompt = Prompt(title = title, subtitle = subtitle, description = description)
      }
    }
  }

  val androidBiometric = options.getMap("biometric")?.getMap("android")
  if (androidBiometric != null) {
    val promptMap = androidBiometric.getMap("prompt")
    val jsStrongBoxPreferred = if (androidBiometric.hasKey("strongBoxPreferred") && !androidBiometric.isNull("strongBoxPreferred")) {
      androidBiometric.getBoolean("strongBoxPreferred")
    } else null
    if (promptMap != null || jsStrongBoxPreferred != null) {
      bindingConfig.biometricAuthenticatorConfig {
        jsStrongBoxPreferred?.let { strongBoxPreferred = it }
        if (promptMap != null) {
          val promptTitle = parseStringOption(promptMap, "title")
          val promptSubtitle = parseStringOption(promptMap, "subtitle")
          val promptDescription = parseStringOption(promptMap, "description")
          val promptNegativeButton = parseStringOption(promptMap, "negativeButtonText")
          if (promptTitle != null || promptSubtitle != null || promptDescription != null || promptNegativeButton != null) {
            promptInfo {
              promptTitle?.let { setTitle(it) }
              promptSubtitle?.let { setSubtitle(it) }
              promptDescription?.let { setDescription(it) }
              promptNegativeButton?.let { setNegativeButtonText(it) }
            }
          }
        }
      }
    }
  }

  val jwt = options.getMap("jwt")
  if (jwt != null) {
    if (jwt.hasKey("issueTimeEpochSeconds") && !jwt.isNull("issueTimeEpochSeconds")) {
      val epoch = jwt.getDouble("issueTimeEpochSeconds").toLong()
      bindingConfig.issueTime = { Instant.ofEpochSecond(epoch) }
    }
    if (jwt.hasKey("notBeforeTimeEpochSeconds") && !jwt.isNull("notBeforeTimeEpochSeconds")) {
      val epoch = jwt.getDouble("notBeforeTimeEpochSeconds").toLong()
      bindingConfig.notBeforeTime = { Instant.ofEpochSecond(epoch) }
    }
    if (jwt.hasKey("expirationTimeEpochSeconds") && !jwt.isNull("expirationTimeEpochSeconds")) {
      val epoch = jwt.getDouble("expirationTimeEpochSeconds").toLong()
      bindingConfig.expirationTime = { Instant.ofEpochSecond(epoch) }
    }
  }
}

private fun parseCacheStrategy(value: String): CacheStrategy = when (value) {
  "cache" -> CacheStrategy.CACHE
  "cache_on_failure" -> CacheStrategy.CACHE_ON_FAILURE
  else -> CacheStrategy.NO_CACHE
}

// ─── Test support ────────────────────────────────────────────────────────────

@VisibleForTesting
internal data class ParsedBindingOptions(
  val appPinMaxAttempts: Int?,
  val appPinKeystoreType: String?,
  val appPinPromptTitle: String?,
  val appPinPromptSubtitle: String?,
  val appPinPromptDescription: String?,
  val biometricAndroidStrongBoxPreferred: Boolean?,
  val biometricAndroidPromptTitle: String?,
  val biometricAndroidPromptSubtitle: String?,
  val biometricAndroidPromptDescription: String?,
  val biometricAndroidPromptNegativeButtonText: String?,
  val jwtIssueTimeEpochSeconds: Long?,
  val jwtNotBeforeTimeEpochSeconds: Long?,
  val jwtExpirationTimeEpochSeconds: Long?,
)

@VisibleForTesting
internal fun parseBindingOptionsForTest(options: ReadableMap?): ParsedBindingOptions {
  if (options == null) return ParsedBindingOptions(
    null, null, null, null, null, null, null, null, null, null, null, null, null
  )
  val appPin = options.getMap("appPin")
  val appPinMaxAttempts = if (appPin != null && appPin.hasKey("maxAttempts") && !appPin.isNull("maxAttempts")) {
    appPin.getDouble("maxAttempts").toInt()
  } else null
  val promptMap = appPin?.getMap("prompt")

  val androidBiometric = options.getMap("biometric")?.getMap("android")
  val biometricAndroidStrongBoxPreferred = if (
    androidBiometric != null &&
    androidBiometric.hasKey("strongBoxPreferred") &&
    !androidBiometric.isNull("strongBoxPreferred")
  ) androidBiometric.getBoolean("strongBoxPreferred") else null
  val biometricPromptMap = androidBiometric?.getMap("prompt")

  val jwt = options.getMap("jwt")
  return ParsedBindingOptions(
    appPinMaxAttempts = appPinMaxAttempts,
    appPinKeystoreType = parseStringOption(appPin, "keystoreType"),
    appPinPromptTitle = parseStringOption(promptMap, "title"),
    appPinPromptSubtitle = parseStringOption(promptMap, "subtitle"),
    appPinPromptDescription = parseStringOption(promptMap, "description"),
    biometricAndroidStrongBoxPreferred = biometricAndroidStrongBoxPreferred,
    biometricAndroidPromptTitle = parseStringOption(biometricPromptMap, "title"),
    biometricAndroidPromptSubtitle = parseStringOption(biometricPromptMap, "subtitle"),
    biometricAndroidPromptDescription = parseStringOption(biometricPromptMap, "description"),
    biometricAndroidPromptNegativeButtonText = parseStringOption(biometricPromptMap, "negativeButtonText"),
    jwtIssueTimeEpochSeconds = if (jwt != null && jwt.hasKey("issueTimeEpochSeconds") && !jwt.isNull("issueTimeEpochSeconds")) jwt.getDouble("issueTimeEpochSeconds").toLong() else null,
    jwtNotBeforeTimeEpochSeconds = if (jwt != null && jwt.hasKey("notBeforeTimeEpochSeconds") && !jwt.isNull("notBeforeTimeEpochSeconds")) jwt.getDouble("notBeforeTimeEpochSeconds").toLong() else null,
    jwtExpirationTimeEpochSeconds = if (jwt != null && jwt.hasKey("expirationTimeEpochSeconds") && !jwt.isNull("expirationTimeEpochSeconds")) jwt.getDouble("expirationTimeEpochSeconds").toLong() else null,
  )
}
