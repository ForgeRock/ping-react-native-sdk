/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnoath

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the OATH API on Android.
 *
 * @remarks
 * This class binds the generated TurboModule spec to the shared native
 * implementation in [RNPingOathCommon]. All heavy lifting is delegated to the
 * common object to keep parity with the classic module.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingOathModule.NAME)
class RNPingOathModule(reactContext: ReactApplicationContext) :
  NativeRNPingOathSpec(reactContext) {

  init {
    RNPingOathCommon.configure(reactContext)
  }

  /**
   * Expose the module name to React Native.
   *
   * @return Registered module name used by the bridge.
   */
  override fun getName(): String = NAME

  /**
   * Clean up native resources when the bridge is torn down.
   */
  override fun invalidate() {
    RNPingOathCommon.cleanup()
    super.invalidate()
  }

  /**
   * Create a new native OATH client and return a handle for subsequent calls.
   *
   * @param config JS-provided configuration map (reserved for future storage options).
   * @param promise Promise resolved with a UUID handle string or rejected with GenericError.
   */
  override fun create(config: ReadableMap, promise: Promise) {
    RNPingOathCommon.create(config, promise)
  }

  /**
   * Parse an otpauth:// or mfauth:// URI and persist the resulting credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param uri The URI string to parse and register.
   * @param promise Promise resolved with the encoded credential map or rejected with GenericError.
   */
  override fun addCredentialFromUri(handle: String, uri: String, promise: Promise) {
    RNPingOathCommon.addCredentialFromUri(handle, uri, promise)
  }

  /**
   * Retrieve a single credential by its ID.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential to retrieve.
   * @param promise Promise resolved with the encoded credential map (or null if not found) or rejected with GenericError.
   */
  override fun getCredential(handle: String, credentialId: String, promise: Promise) {
    RNPingOathCommon.getCredential(handle, credentialId, promise)
  }

  /**
   * Retrieve all stored credentials.
   *
   * @param handle The UUID handle returned by [create].
   * @param promise Promise resolved with an array of encoded credential maps or rejected with GenericError.
   */
  override fun getCredentials(handle: String, promise: Promise) {
    RNPingOathCommon.getCredentials(handle, promise)
  }

  /**
   * Persist an updated credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param credential The credential fields as a JS map.
   * @param promise Promise resolved with the saved credential map or rejected with GenericError.
   */
  override fun saveCredential(handle: String, credential: ReadableMap, promise: Promise) {
    RNPingOathCommon.saveCredential(handle, credential, promise)
  }

  /**
   * Delete a credential by its ID.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential to delete.
   * @param promise Promise resolved with true on success or rejected with GenericError.
   */
  override fun deleteCredential(handle: String, credentialId: String, promise: Promise) {
    RNPingOathCommon.deleteCredential(handle, credentialId, promise)
  }

  /**
   * Generate a one-time password code for a credential.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential.
   * @param promise Promise resolved with the OTP code string or rejected with GenericError.
   */
  override fun generateCode(handle: String, credentialId: String, promise: Promise) {
    RNPingOathCommon.generateCode(handle, credentialId, promise)
  }

  /**
   * Generate a one-time password code along with validity information.
   *
   * @param handle The UUID handle returned by [create].
   * @param credentialId The unique identifier of the credential.
   * @param promise Promise resolved with an encoded code-info map or rejected with GenericError.
   */
  override fun generateCodeWithValidity(handle: String, credentialId: String, promise: Promise) {
    RNPingOathCommon.generateCodeWithValidity(handle, credentialId, promise)
  }

  /**
   * Release the native client associated with the handle.
   *
   * @param handle The UUID handle returned by [create].
   * @param promise Promise resolved with null on success or rejected with GenericError.
   */
  override fun close(handle: String, promise: Promise) {
    RNPingOathCommon.close(handle, promise)
  }

  /**
   * Register an OATH policy evaluator configuration and return the registry id.
   *
   * @param config Map containing `policies` (array of kind strings) and optionally `loggerId`.
   * @return Opaque UUID id for the registered evaluator descriptor.
   */
  override fun registerOathPolicyEvaluator(config: ReadableMap): String {
    return RNPingOathCommon.registerOathPolicyEvaluator(config)
  }

  /**
   * Retrieve a previously registered policy evaluator descriptor by id.
   *
   * @param id Registry id returned by [registerOathPolicyEvaluator].
   * @return Map containing `policies` (array of kind strings) and optionally `loggerId`.
   */
  override fun configureOathPolicyEvaluator(id: String): WritableMap {
    return RNPingOathCommon.configureOathPolicyEvaluator(id)
  }

  companion object {
    /** Name used for React Native module registration. */
    const val NAME = "RNPingOath"
  }
}
