/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.pingidentity.fido.FidoAuthenticateCustomizer

/**
 * Builds the native `FidoAuthenticateCustomizer` block for one authentication call.
 *
 * The selected route is the explicit `useFido2ApiClient` flag when present, otherwise the native
 * default: Play Services when the Play Services FIDO API is on the classpath, Credential Manager
 * otherwise. A block never changes the route. The `credentialManager` block is installed only
 * when the selected route is Credential Manager, and the `playServices` block only when the
 * selected route is Play Services and the Play Services FIDO API is available. A block that is
 * not installed is reported and dropped. Supplying both blocks is allowed.
 *
 * Play Services types are only reached through [FidoPlayServicesRequestCustomizer], which is
 * instantiated only when the Play Services route is applied.
 *
 * @property isPlayServicesAvailable Whether the Play Services FIDO API is on the classpath. The
 *   default reads the native customizer default, which is the same classpath probe the native
 *   SDK uses to pick its route.
 */
internal class FidoAuthenticateCustomizerFactory(
  private val isPlayServicesAvailable: () -> Boolean = { FidoAuthenticateCustomizer().useFido2ApiClient }
) {

  /**
   * Builds the customizer block for an authentication call.
   *
   * Blocks that cannot apply are reported while the block is built, before the ceremony starts.
   *
   * @param callConfig Parsed call configuration.
   * @return Block to pass to the native authenticate entry points.
   */
  fun create(callConfig: FidoCallConfig): FidoAuthenticateCustomizer.() -> Unit {
    val explicit = callConfig.useFido2ApiClient
    val playServicesAvailable = isPlayServicesAvailable()
    val playServicesSelected = explicit ?: playServicesAvailable
    val warn = callConfig.warningSink()
    val installers = buildList<(FidoAuthenticateCustomizer) -> Unit> {
      callConfig.credentialManagerSignIn?.let { spec ->
        if (playServicesSelected) {
          warn(ignored(CREDENTIAL_MANAGER_PATH, "the selected route is Play Services; the block is not applied"))
        } else {
          val customizer = FidoCredentialManagerSignInCustomizer(spec, warn)
          add { it.onGetPublicKeyCredentialOption(customizer::customize) }
        }
      }
      callConfig.playServicesRequest?.let { spec ->
        if (!playServicesSelected) {
          warn(ignored(PLAY_SERVICES_PATH, "the selected route is Credential Manager; the block is not applied"))
        } else if (!playServicesAvailable) {
          warn(ignored(PLAY_SERVICES_PATH, "the Play Services FIDO API is not available on this device; the block is not applied"))
        } else {
          add { FidoPlayServicesRequestCustomizer(spec, warn).install(it) }
        }
      }
    }
    // TODO: once the consumed native release exposes
    // FidoAuthenticateCustomizer.onGetCredentialRequest, apply
    // callConfig.preferImmediatelyAvailableCredentials there and remove the unsupported-option
    // warning in FidoCallConfig.authenticationPreference. 
    // TODO-PARITY (SDKS-5624): iOS applies this option to
    // authentication only, while Android 2.2.0 applies it to registration only.
    return {
      explicit?.let { useFido2ApiClient = it }
      installers.forEach { install -> install(this) }
    }
  }

  private fun ignored(path: String, consequence: String): String {
    return "FIDO config key '$path' received an Object; $consequence"
  }

  private companion object {
    const val CREDENTIAL_MANAGER_PATH = "android.credentialManager"
    const val PLAY_SERVICES_PATH = "android.playServices"
  }
}
