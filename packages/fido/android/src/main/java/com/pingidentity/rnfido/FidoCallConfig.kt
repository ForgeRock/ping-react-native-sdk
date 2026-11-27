/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.ReadableMap
import com.pingidentity.logger.Logger
import com.pingidentity.rncore.utils.JsonBridgeMapper

/**
 * Per-call FIDO runtime configuration parsed from the React Native bridge payload.
 *
 * @property loggerId Trimmed logger handle identifier, or null when absent, blank or not a string.
 * @property logger Native logger resolved from the Core registry, or null when none resolved.
 * @property useFido2ApiClient Explicit FIDO2 API routing flag; null keeps native auto-detection.
 * @property preferImmediatelyAvailableCredentials Authentication-only credential preference, retained as
 *   parsed. It is not consumed yet: it is kept for wiring through
 *   `FidoAuthenticateCustomizer.onGetCredentialRequest`, which the native 2.2.0 SDK does not offer, so a
 *   warning is emitted meanwhile. Always null for registration, where the top-level value is folded into
 *   [createRequestSpec] instead.
 * @property createRequestSpec Credential Manager registration overrides, including the top-level credential
 *   preference unless `android.credentialManager` sets its own; null when none were supplied.
 * @property credentialManagerSignIn Credential Manager authentication overrides from
 *   `android.credentialManager`; null when the block was not supplied. Always null for registration.
 * @property playServicesRequest Play Services authentication overrides from `android.playServices`;
 *   null when the block was not supplied. Always null for registration.
 */
internal data class FidoCallConfig(
  val loggerId: String?,
  val logger: Logger?,
  val useFido2ApiClient: Boolean?,
  val preferImmediatelyAvailableCredentials: Boolean?,
  val createRequestSpec: FidoCreateRequestSpec?,
  val credentialManagerSignIn: FidoCredentialManagerSignInSpec? = null,
  val playServicesRequest: FidoPlayServicesRequestSpec? = null
) {

  /**
   * Sink for option and customizer warnings tied to this call's logger.
   *
   * @return Function that emits a single warning message.
   */
  fun warningSink(): (String) -> Unit {
    return FidoWarningSink.create(logger)
  }

  /** The FIDO ceremony a bridge call drives. */
  enum class Ceremony {
    /** FIDO credential registration. */
    REGISTRATION,

    /** FIDO authentication (assertion). */
    AUTHENTICATION
  }

  companion object {
    private const val LOGGER_ID_KEY = "loggerId"
    private const val USE_FIDO2_API_CLIENT_KEY = "useFido2ApiClient"
    private const val PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY = "preferImmediatelyAvailableCredentials"
    private const val ANDROID_KEY = "android"
    private const val IOS_KEY = "ios"
    private const val CREDENTIAL_MANAGER_KEY = "credentialManager"
    private const val PLAY_SERVICES_KEY = "playServices"
    private const val REQUEST_JSON_KEY = "requestJson"
    private const val CLIENT_DATA_HASH_KEY = "clientDataHash"
    private const val ORIGIN_KEY = "origin"
    private const val IS_AUTO_SELECT_ALLOWED_KEY = "isAutoSelectAllowed"
    private const val IS_CONDITIONAL_KEY = "isConditional"
    private const val PREFER_DEFAULT_PROVIDER_KEY = "preferDefaultProvider"

    private val TOP_LEVEL_KEYS = setOf(
      LOGGER_ID_KEY,
      USE_FIDO2_API_CLIENT_KEY,
      PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY,
      ANDROID_KEY,
      IOS_KEY
    )
    private val ANDROID_KEYS = setOf(CREDENTIAL_MANAGER_KEY, PLAY_SERVICES_KEY)
    private val CREATE_REQUEST_KEYS = setOf(
      REQUEST_JSON_KEY,
      CLIENT_DATA_HASH_KEY,
      PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY,
      ORIGIN_KEY,
      IS_AUTO_SELECT_ALLOWED_KEY,
      IS_CONDITIONAL_KEY,
      PREFER_DEFAULT_PROVIDER_KEY
    )

    /**
     * Parses the bridge payload, reporting option problems before any fallback applies.
     *
     * The payload is parsed twice: once silently to find the logger handle, then once with
     * warnings routed to the sink for that logger. Parsing is synchronous and pure, so both
     * passes agree on the handle.
     *
     * @param config Raw bridge configuration payload.
     * @param ceremony Ceremony the call drives.
     * @param resolveLogger Resolves a logger handle id to the native logger, or null.
     * @return Parsed call configuration; invalid values fall back to native defaults.
     */
    fun resolve(
      config: ReadableMap,
      ceremony: Ceremony,
      resolveLogger: (String?) -> Logger?
    ): FidoCallConfig {
      val logger = resolveLogger(parse(config, ceremony, null) {}.loggerId)
      return parse(config, ceremony, logger, FidoWarningSink.create(logger))
    }

    private fun parse(
      config: ReadableMap,
      ceremony: Ceremony,
      logger: Logger?,
      warn: (String) -> Unit
    ): FidoCallConfig {
      val reader = FidoOptionReader(config, "", warn)
      val loggerId = reader.string(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
      val useFido2ApiClient = reader.boolean(USE_FIDO2_API_CLIENT_KEY)
      val topLevelPreference = reader.boolean(PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY)
      val preferImmediatelyAvailableCredentials = authenticationPreference(reader, ceremony, topLevelPreference)
      val android = reader.child(ANDROID_KEY)
      android?.warnUnknownKeys(ANDROID_KEYS)
      val createRequestSpec = parseRegistrationAndroid(android, ceremony, topLevelPreference)
      val authenticationAndroid = android.takeIf { ceremony == Ceremony.AUTHENTICATION }
      reader.warnIfPresent(IOS_KEY, "iOS-only options are ignored on Android")
      reader.warnUnknownKeys(TOP_LEVEL_KEYS)
      return FidoCallConfig(
        loggerId = loggerId,
        logger = logger,
        useFido2ApiClient = useFido2ApiClient,
        preferImmediatelyAvailableCredentials = preferImmediatelyAvailableCredentials,
        createRequestSpec = createRequestSpec,
        credentialManagerSignIn = authenticationAndroid
          ?.child(CREDENTIAL_MANAGER_KEY)
          ?.let { FidoAuthenticateOptionParser.credentialManager(it) },
        playServicesRequest = authenticationAndroid
          ?.child(PLAY_SERVICES_KEY)
          ?.let { FidoAuthenticateOptionParser.playServices(it) }
      )
    }

    private fun authenticationPreference(
      reader: FidoOptionReader,
      ceremony: Ceremony,
      topLevelPreference: Boolean?
    ): Boolean? {
      if (ceremony != Ceremony.AUTHENTICATION || topLevelPreference == null) {
        return null
      }
      reader.warnIfPresent(
        PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY,
        "Android does not support this option for authentication and the native sign-in flow applies"
      )
      return topLevelPreference
    }

    private fun parseRegistrationAndroid(
      android: FidoOptionReader?,
      ceremony: Ceremony,
      topLevelPreference: Boolean?
    ): FidoCreateRequestSpec? {
      if (ceremony != Ceremony.REGISTRATION) {
        return null
      }
      android?.warnIfPresent(
        PLAY_SERVICES_KEY,
        "registration uses Credential Manager and this block is ignored"
      )
      val spec = parseCreateRequest(android?.child(CREDENTIAL_MANAGER_KEY))
      val preference = spec?.preferImmediatelyAvailableCredentials ?: topLevelPreference ?: return spec
      return (spec ?: FidoCreateRequestSpec()).copy(preferImmediatelyAvailableCredentials = preference)
    }

    private fun parseCreateRequest(reader: FidoOptionReader?): FidoCreateRequestSpec? {
      if (reader == null) {
        return null
      }
      val spec = FidoCreateRequestSpec(
        requestJsonPatch = reader.map(REQUEST_JSON_KEY)?.let { JsonBridgeMapper.decodeReadableMap(it) },
        clientDataHash = reader.string(CLIENT_DATA_HASH_KEY),
        preferImmediatelyAvailableCredentials = reader.boolean(PREFER_IMMEDIATELY_AVAILABLE_CREDENTIALS_KEY),
        origin = reader.string(ORIGIN_KEY),
        isAutoSelectAllowed = reader.boolean(IS_AUTO_SELECT_ALLOWED_KEY),
        isConditional = reader.boolean(IS_CONDITIONAL_KEY),
        preferDefaultProvider = reader.string(PREFER_DEFAULT_PROVIDER_KEY)
      )
      reader.warnUnknownKeys(CREATE_REQUEST_KEYS)
      return spec.takeUnless { it.isEmpty }
    }
  }
}
