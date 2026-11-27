/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type {
  DaVinciInstance,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-types';

/**
 * JSON-compatible value used by FIDO bridge payloads.
 */
export type FidoJsonValue =
  | string
  | number
  | boolean
  | null
  | FidoJsonValue[]
  | { [key: string]: FidoJsonValue };

/**
 * Dictionary-style FIDO registration options passed to native.
 *
 * @remarks
 * This v1 type intentionally stays flexible to match platform SDK payloads.
 */
export type FidoRegistrationOptions = { [key: string]: FidoJsonValue };

/**
 * Dictionary-style FIDO authentication options passed to native.
 *
 * @remarks
 * This v1 type intentionally stays flexible to match platform SDK payloads.
 */
export type FidoAuthenticationOptions = { [key: string]: FidoJsonValue };

/**
 * JSON-compatible FIDO registration result returned by native.
 */
export type FidoRegistrationResult = { [key: string]: FidoJsonValue };

/**
 * JSON-compatible FIDO authentication result returned by native.
 */
export type FidoAuthenticationResult = { [key: string]: FidoJsonValue };

/**
 * Success payload returned by Journey-scoped FIDO operations.
 */
export type FidoJourneyResult = {
  type: 'success';
};

/**
 * Options for Journey-scoped FIDO registration callback execution.
 *
 * @remarks
 * Unlike standalone `register`, which takes ceremony options as a separate
 * second argument and reserves the first argument for the WebAuthn payload,
 * Journey callback execution merges the ceremony options into this single
 * options bag, keeping the execution signature (Journey instance plus
 * options) simple.
 */
export type FidoJourneyRegistrationOptions = {
  /**
   * Optional callback index when multiple FIDO registration callbacks are present.
   */
  index?: number;
  /**
   * Optional user-facing device name passed to native registration.
   */
  deviceName?: string;
  /**
   * Optional ceremony options; see {@link FidoRegistrationCeremonyOptions}.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Optional Android-only registration overrides; see
   * {@link FidoRegistrationCeremonyOptions}.
   */
  android?: FidoRegistrationCeremonyOptions['android'];
};

/**
 * Options for Journey-scoped FIDO authentication callback execution.
 *
 * @remarks
 * Unlike standalone `authenticate`, which takes ceremony options as a
 * separate second argument and reserves the first argument for the WebAuthn
 * payload, Journey callback execution merges the ceremony options into this
 * single options bag, keeping the execution signature (Journey instance plus
 * options) simple.
 */
export type FidoJourneyAuthenticationOptions = {
  /**
   * Optional callback index when multiple FIDO authentication callbacks are present.
   */
  index?: number;
  /**
   * Optional ceremony options; see {@link FidoAuthenticationCeremonyOptions}.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Optional Android-only authentication overrides and API routing; see
   * {@link FidoAuthenticationCeremonyOptions}.
   */
  android?: FidoAuthenticationCeremonyOptions['android'];
};

/**
 * DaVinci collector type emitted for FIDO collectors.
 *
 * @remarks
 * Both native DaVinci FIDO plugins register a single `FIDO2` collector type,
 * discriminated by `action` into registration and authentication variants.
 */
export const fidoCollectorType = 'FIDO2' as const;

/**
 * DaVinci collector requesting FIDO passkey registration.
 *
 * @public
 */
export type FidoRegistrationCollector = {
  /** Stable server-assigned identifier used as the collector key. */
  key: string;
  /** FIDO collector type. */
  type: typeof fidoCollectorType;
  /** Ceremony action dispatched by the native collector factory. */
  action: 'REGISTER';
  /** Human-readable label rendered for the collector. */
  label: string;
  /** Whether the collector must be completed before submission. */
  required: boolean;
  /**
   * Raw server-supplied `trigger` value.
   *
   * @remarks
   * Emitted on both platforms exactly as the native collector reports it, and
   * `""` when the server omits the field. Android exposes only this raw value.
   * iOS derives an internal `isAutomatic` launch flag from it (false when
   * empty or case-insensitively `"BUTTON"`, true otherwise) that JS does not
   * expose, so the raw value carries no cross-platform launch semantic.
   * Typed optional for consumers written against releases where the iOS
   * collector omitted the field; both platforms now always emit it.
   */
  trigger?: string;
  /**
   * WebAuthn public key credential creation options returned by the server.
   *
   * @remarks
   * The native SDKs encode raw identifier arrays before the payload crosses the
   * bridge. Android emits unpadded base64url and iOS emits standard base64, so
   * consumers that decode these values must accept both flavours.
   */
  publicKeyCredentialCreationOptions?: Record<string, unknown>;
  /** Original server-side field JSON when available. */
  raw?: Record<string, unknown>;
};

/**
 * DaVinci collector requesting FIDO passkey authentication.
 *
 * @public
 */
export type FidoAuthenticationCollector = {
  /** Stable server-assigned identifier used as the collector key. */
  key: string;
  /** FIDO collector type. */
  type: typeof fidoCollectorType;
  /** Ceremony action dispatched by the native collector factory. */
  action: 'AUTHENTICATE';
  /** Human-readable label rendered for the collector. */
  label: string;
  /** Whether the collector must be completed before submission. */
  required: boolean;
  /**
   * Raw server-supplied `trigger` value.
   *
   * @remarks
   * Emitted on both platforms exactly as the native collector reports it, and
   * `""` when the server omits the field. Android exposes only this raw value.
   * iOS derives an internal `isAutomatic` launch flag from it (false when
   * empty or case-insensitively `"BUTTON"`, true otherwise) that JS does not
   * expose, so the raw value carries no cross-platform launch semantic.
   * Typed optional for consumers written against releases where the iOS
   * collector omitted the field; both platforms now always emit it.
   */
  trigger?: string;
  /**
   * WebAuthn public key credential request options returned by the server.
   *
   * @remarks
   * The native SDKs encode raw identifier arrays before the payload crosses the
   * bridge. Android emits unpadded base64url and iOS emits standard base64, so
   * consumers that decode these values must accept both flavours.
   */
  publicKeyCredentialRequestOptions?: Record<string, unknown>;
  /** Original server-side field JSON when available. */
  raw?: Record<string, unknown>;
};

/**
 * DaVinci collector supplied by the FIDO plugin.
 *
 * @remarks
 * Discriminated by `action` into {@link FidoRegistrationCollector} and
 * {@link FidoAuthenticationCollector}. Deliberately does not extend the
 * DaVinci `BaseCollector` because the native FIDO base class is not a field
 * collector.
 *
 * @public
 */
export type FidoCollector =
  | FidoRegistrationCollector
  | FidoAuthenticationCollector;

/**
 * Options for DaVinci-scoped FIDO registration ceremony execution.
 *
 * @remarks
 * Unlike standalone `register`, which takes ceremony options as a separate
 * second argument and reserves the first argument for the WebAuthn payload,
 * DaVinci collector execution merges the ceremony options into this single
 * options bag, keeping the execution signature (DaVinci instance plus
 * options) simple.
 *
 * @public
 */
export type FidoDaVinciRegistrationOptions = {
  /**
   * Optional collector index when multiple FIDO2 registration collectors are present.
   */
  index?: number;
  /**
   * Optional ceremony options; see {@link FidoRegistrationCeremonyOptions}.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Optional Android-only registration overrides; see
   * {@link FidoRegistrationCeremonyOptions}.
   */
  android?: FidoRegistrationCeremonyOptions['android'];
};

/**
 * Options for DaVinci-scoped FIDO authentication ceremony execution.
 *
 * @remarks
 * Unlike standalone `authenticate`, which takes ceremony options as a
 * separate second argument and reserves the first argument for the WebAuthn
 * payload, DaVinci collector execution merges the ceremony options into this
 * single options bag, keeping the execution signature (DaVinci instance plus
 * options) simple.
 *
 * @public
 */
export type FidoDaVinciAuthenticationOptions = {
  /**
   * Optional collector index when multiple FIDO2 authentication collectors are present.
   */
  index?: number;
  /**
   * Optional ceremony options; see {@link FidoAuthenticationCeremonyOptions}.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Optional Android-only authentication overrides and API routing; see
   * {@link FidoAuthenticationCeremonyOptions}.
   */
  android?: FidoAuthenticationCeremonyOptions['android'];
};

/**
 * Android-specific FIDO runtime configuration options.
 */
export type FidoAndroidConfig = {
  /**
   * Android FIDO2 API selection override for authentication.
   *
   * @deprecated Prefer the per-call `android.useFido2ApiClient` ceremony
   * option, which matches the native SDK where the route is selected per
   * authentication call. This client-level flag remains supported.
   *
   * @remarks
   * Applies on Android only, to `authenticate`, `authenticateForJourney` and
   * `authenticateForDaVinci`. Registration is not affected. On iOS the
   * client-level flag is not sent to native: the key is omitted from the
   * native configuration. A per-call `android.useFido2ApiClient` takes
   * precedence over this flag.
   * - `undefined`: Use native SDK auto-detection/default behavior.
   * - `true`: Force Google Play Services FIDO2 APIs.
   * - `false`: Force Android Credential Manager APIs.
   *
   * @example
   * ```ts
   * // Android-only flag; iOS omits it and keeps native auto-detection.
   * const fido = createFidoClient({ android: { useFido2ApiClient: true } });
   * ```
   */
  useFido2ApiClient?: boolean;
};

/**
 * Runtime configuration for the FIDO module.
 */
export type FidoConfig = {
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   * JavaScript-side FIDO logs use this logger on both platforms.
   * Native logger forwarding applies to standalone operations on both platforms.
   * Journey and DaVinci ceremonies keep their workflow-configured native
   * logger for the ceremony itself; the logger identified here only receives
   * the warnings about ignored or invalid ceremony options.
   */
  logger?: LoggerInstance;
  /**
   * Optional Android-specific configuration.
   */
  android?: FidoAndroidConfig;
};

/**
 * Credential Manager create-request overrides for Android FIDO registration.
 *
 * @remarks
 * Applied natively to the `CreatePublicKeyCredentialRequest` the Android SDK
 * builds for the registration ceremony. A field left unset keeps the native
 * value. Android only: on iOS the whole `android` block is removed from the
 * native configuration before the call.
 *
 * @example
 * ```ts
 * const ceremonyOptions = {
 *   android: {
 *     credentialManager: {
 *       preferImmediatelyAvailableCredentials: true,
 *       preferDefaultProvider: 'com.example.auth/.PasskeyProvider',
 *     },
 *   },
 * };
 * ```
 *
 * @public
 */
export type FidoAndroidRegistrationOptions = {
  /**
   * JSON merge patch (RFC 7396) applied to the SDK-transformed registration
   * request JSON: nested objects merge, arrays replace, `null` deletes.
   */
  requestJson?: Record<string, FidoJsonValue>;
  /**
   * Base64url (unpadded or validly padded) client data hash overriding the
   * native value. Malformed padding is rejected with argument_error before any
   * native call.
   */
  clientDataHash?: string;
  /**
   * Restricts credential creation to providers that are immediately available.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Caller origin for privileged registration requests.
   *
   * @remarks
   * Requires the host app to hold the privileged-apps permission.
   */
  origin?: string;
  /**
   * Whether the credential may be auto-selected.
   */
  isAutoSelectAllowed?: boolean;
  /**
   * Whether the request is a conditional (silent) creation.
   */
  isConditional?: boolean;
  /**
   * Flattened component name (`package/class`) of the preferred provider.
   *
   * @remarks
   * Cannot be combined with `isConditional` set to `true`; such a call rejects
   * with an argument error before native.
   */
  preferDefaultProvider?: string;
};

/**
 * Credential Manager sign-in overrides for Android FIDO authentication.
 *
 * @remarks
 * Applied natively to the `GetPublicKeyCredentialOption` the Android SDK
 * builds for the authentication ceremony. A field left unset keeps the native
 * value. The block is applied only when the selected route is Credential
 * Manager; otherwise it is not applied and a warning is logged. Android only:
 * on iOS the whole `android` block is removed from the native configuration
 * before the call.
 *
 * @example
 * ```ts
 * const ceremonyOptions = {
 *   android: {
 *     useFido2ApiClient: false,
 *     credentialManager: {
 *       allowedProviders: ['com.example.auth/.PasskeyProvider'],
 *     },
 *   },
 * };
 * ```
 *
 * @public
 */
export type FidoAndroidCredentialManagerOptions = {
  /**
   * JSON merge patch (RFC 7396) applied to the SDK-transformed sign-in
   * request JSON: nested objects merge, arrays replace, `null` deletes.
   */
  requestJson?: Record<string, FidoJsonValue>;
  /**
   * Base64url (unpadded or validly padded) client data hash overriding the
   * native value. Malformed padding is rejected with argument_error before any
   * native call.
   */
  clientDataHash?: string;
  /**
   * Flattened component names (`package/class`) of the credential providers
   * allowed to serve the request.
   */
  allowedProviders?: string[];
};

/**
 * Play Services request overrides for Android FIDO authentication.
 *
 * @remarks
 * Applied natively to the `PublicKeyCredentialRequestOptions` the Android SDK
 * builds for the authentication ceremony. A field left unset keeps the native
 * value. The block is applied only when the selected route is Play Services
 * and the Play Services FIDO API is available; otherwise it is not applied
 * and a warning is logged. Android only: on iOS the whole `android` block is
 * removed from the native configuration before the call.
 *
 * The host app must declare `com.google.android.gms:play-services-fido`; the
 * package declares it `compileOnly`, so it is not bundled transitively. Without
 * it native auto-detection selects Credential Manager and a supplied
 * `playServices` block is not applied and a warning is logged. `useFido2ApiClient: true` does not make
 * the block apply without it.
 *
 * @example
 * ```ts
 * const ceremonyOptions = {
 *   android: {
 *     useFido2ApiClient: true,
 *     playServices: {
 *       timeoutSeconds: 60,
 *       transports: ['usb', 'nfc', 'ble'],
 *     },
 *   },
 * };
 * ```
 *
 * @public
 */
export type FidoAndroidPlayServicesOptions = {
  /**
   * Request timeout in seconds.
   */
  timeoutSeconds?: number;
  /**
   * Request id.
   */
  requestId?: number;
  /**
   * WebAuthn transport names, for example `usb`, `nfc` or `ble`, applied to
   * every credential of the allow list.
   *
   * @remarks
   * One flat list for all descriptors; there is no per-credential transport
   * selection. Transport names are forwarded to native unchanged: native
   * drops unsupported names with a warning, so no JavaScript-side name
   * allowlist is applied.
   */
  transports?: string[];
  /**
   * FIDO authentication extensions.
   */
  authenticationExtensions?: {
    /**
     * Legacy FIDO AppID extension value.
     */
    fidoAppId?: string;
    /**
     * Whether to request the user verification method extension.
     */
    userVerificationMethod?: boolean;
  };
};

/**
 * Ceremony-level options for FIDO registration.
 *
 * @remarks
 * Passed as the second argument to standalone `register`, and merged into the
 * Journey and DaVinci registration option objects. `android.credentialManager`
 * carries the Credential Manager create-request overrides; registration always
 * uses Credential Manager on Android, so a supplied `android.playServices`
 * block is removed with a warning.
 *
 * @example
 * ```ts
 * await fido.register(
 *   { challenge: challengeFromServer },
 *   { preferImmediatelyAvailableCredentials: true },
 * );
 * ```
 *
 * @public
 */
export type FidoRegistrationCeremonyOptions = {
  /**
   * Marks credential creation as preferring immediately available providers:
   * when no local credential offering exists, the operation returns
   * immediately instead of falling back to remote discovery.
   *
   * @remarks
   * It is a preference, not a guarantee about dialog contents; the credential
   * provider may still present secondary save paths in its UI. Android applies
   * the value to the Credential Manager create request in all scopes
   * (standalone, Journey, DaVinci). iOS applies the credential preference to
   * authentication only: on registration the value is reported by native and
   * the full registration flow applies.
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Android-only registration overrides.
   */
  android?: {
    /**
     * Credential Manager create-request overrides.
     */
    credentialManager?: FidoAndroidRegistrationOptions;
  };
};

/**
 * Ceremony-level options for FIDO authentication.
 *
 * @remarks
 * Passed as the second argument to standalone `authenticate`, and merged into
 * the Journey and DaVinci authentication option objects. The Android API route
 * is selected by `android.useFido2ApiClient`, never by the presence of a
 * block. Both blocks may be supplied; only the one matching the selected route
 * is applied and the other is not applied and logged as a warning.
 *
 * @example
 * ```ts
 * await fido.authenticate(
 *   { challenge: challengeFromServer },
 *   { preferImmediatelyAvailableCredentials: true },
 * );
 * ```
 *
 * @public
 */
export type FidoAuthenticationCeremonyOptions = {
  /**
   * Marks authentication as preferring credentials already present on the
   * device: when no local credential matches, the ceremony cancels instead of
   * falling back to remote discovery.
   *
   * @remarks
   * It is a preference, not a guarantee about dialog contents; the credential
   * provider may still present secondary sign-in paths in its UI. iOS applies
   * the value to the native sign-in flow in all scopes. Android cannot apply
   * it to authentication yet: a warning is logged by native and the native
   * sign-in flow applies (the underlying `onGetCredentialRequest` hook is
   * expected in a later native release).
   */
  preferImmediatelyAvailableCredentials?: boolean;
  /**
   * Android-only authentication overrides and API selection.
   */
  android?: {
    /**
     * Selects the FIDO2 API for this authentication call.
     *
     * @remarks
     * Android only. The selected route is, in order of precedence, this
     * per-call value, then the client-level
     * `createFidoClient({ android: { useFido2ApiClient } })` value, then native
     * auto-detection. Auto-detection selects Google Play Services when the
     * host app includes `play-services-fido` and Credential Manager otherwise,
     * the same default as the native Android SDK. `true` forces Play Services
     * and `false` forces Credential Manager (required for conditional
     * mediation). The `credentialManager` and `playServices` blocks never
     * change the route: a block for the route that is not selected is not
     * applied and a warning is logged. Not part of registration options.
     * Pruned with a warning on iOS.
     */
    useFido2ApiClient?: boolean;
    /**
     * Credential Manager sign-in overrides, applied only when the selected
     * route is Credential Manager.
     */
    credentialManager?: FidoAndroidCredentialManagerOptions;
    /**
     * Play Services request overrides, applied only when the selected route is
     * Play Services and the Play Services FIDO API is available.
     */
    playServices?: FidoAndroidPlayServicesOptions;
  };
};

/**
 * Native ceremony configuration payload composed for each FIDO operation.
 *
 * @remarks
 * Internal wire shape, not user input: built by `createFidoClient` and
 * `buildNativeConfig` for every call and consumed by the native bridge. User
 * routing is expressed through the per-call `android.useFido2ApiClient` ceremony
 * option and the client-level `FidoAndroidConfig.useFido2ApiClient`; this type
 * only carries the client-level value across the bridge. Every operation composes a fresh payload from the client base plus
 * the validated ceremony options, so one call never leaks into another.
 *
 * @internal
 */
export type FidoNativeCeremonyConfig = {
  /**
   * Optional native logger handle id resolved from `logger.nativeHandle.id`.
   */
  loggerId?: string;
  /**
   * Optional Android FIDO2 API selection override for authentication.
   *
   * @remarks
   * Applied to standalone, Journey and DaVinci authentication. On iOS the
   * client-level flag is not sent to native: the key is omitted from the
   * native configuration, which keeps native auto-detection.
   * - `undefined`: Use native SDK auto-detection/default behavior.
   * - `true`: Force Google Play Services FIDO2 APIs.
   * - `false`: Force Android Credential Manager APIs.
   */
  useFido2ApiClient?: boolean;
};

/**
 * Resolved per-client FIDO configuration as exported before release 1.2.
 *
 * @deprecated Internal wire payload; no public function accepts or returns
 * this type. The runtime Android API-selection flag is
 * `FidoAndroidConfig.useFido2ApiClient` (client level) or the per-call
 * `android.useFido2ApiClient` ceremony option.
 *
 * @public
 */
export type FidoClientConfig = {
  /**
   * Optional native logger handle id resolved from `logger.nativeHandle.id`.
   */
  loggerId?: string;
  /**
   * Optional Android FIDO2 API selection override.
   *
   * @remarks
   * - `undefined`: Use native SDK auto-detection/default behavior.
   * - `true`: Force Google Play Services FIDO2 APIs.
   * - `false`: Force Android Credential Manager APIs.
   */
  useFido2Client?: boolean;
};

/**
 * Result payload returned by a successful DaVinci FIDO ceremony.
 *
 * @remarks
 * The payload is the raw WebAuthn attestation or assertion produced by the native
 * ceremony. It is informational only: submission to the DaVinci flow happens
 * natively through the collector, so callers advance the flow with
 * `daVinci.next({ collectors: [] })`.
 *
 * @public
 */
export type FidoDaVinciResult = { [key: string]: FidoJsonValue };

/**
 * Reusable client for FIDO operations.
 */
export interface FidoClient {
  /**
   * Registers a new FIDO credential using native platform APIs.
   *
   * @param options Registration options payload.
   * @param ceremonyOptions Optional ceremony options; see
   *   {@link FidoRegistrationCeremonyOptions}.
   * @returns A promise that resolves to the registration result payload.
   * @throws FidoError with `argument_error` for invalid ceremony options, or
   *   when native registration fails.
   * @example
   * ```ts
   * const result = await fido.register(
   *   { challenge: challengeFromServer },
   *   { preferImmediatelyAvailableCredentials: true },
   * );
   * ```
   */
  register(
    options: FidoRegistrationOptions,
    ceremonyOptions?: FidoRegistrationCeremonyOptions,
  ): Promise<FidoRegistrationResult>;
  /**
   * Authenticates with an existing FIDO credential using native platform APIs.
   *
   * @param options Authentication options payload.
   * @param ceremonyOptions Optional ceremony options; see
   *   {@link FidoAuthenticationCeremonyOptions}.
   * @returns A promise that resolves to the authentication result payload.
   * @throws FidoError with `argument_error` for invalid ceremony options or
   *   routing conflicts, or with code `FIDO_AUTHENTICATE_ERROR` for any native
   *   authentication failure, including user cancellation. Standalone
   *   authentication has no cancellation-specific code; only
   *   `authenticateForJourney` and `authenticateForDaVinci` reject with
   *   `FIDO_AUTHENTICATE_CANCELLED`.
   * @example
   * ```ts
   * const result = await fido.authenticate(
   *   { challenge: challengeFromServer },
   *   { preferImmediatelyAvailableCredentials: true },
   * );
   * ```
   * @example
   * Route the call to Android Credential Manager, overriding the allowlist:
   * ```ts
   * const result = await fido.authenticate({ challenge: challengeFromServer }, {
   *   android: {
   *     credentialManager: {
   *       allowedProviders: ['com.example.auth/.PasskeyProvider'],
   *     },
   *   },
   * });
   * ```
   */
  authenticate(
    options: FidoAuthenticationOptions,
    ceremonyOptions?: FidoAuthenticationCeremonyOptions,
  ): Promise<FidoAuthenticationResult>;
  /**
   * Executes an active Journey FIDO registration callback.
   *
   * @param journey Active Journey instance.
   * @param options Optional registration callback execution options,
   *   including ceremony options; see {@link FidoRegistrationCeremonyOptions}.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws FidoError with `argument_error` for invalid ceremony options, or
   *   when native callback execution fails.
   * @example
   * ```ts
   * await fido.registerForJourney(journey, { deviceName: 'Pixel' });
   * ```
   */
  registerForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyRegistrationOptions,
  ): Promise<FidoJourneyResult>;
  /**
   * Executes an active Journey FIDO authentication callback.
   *
   * @param journey Active Journey instance.
   * @param options Optional authentication callback execution options,
   *   including ceremony options; see
   *   {@link FidoAuthenticationCeremonyOptions}.
   * @returns A promise that resolves when callback execution succeeds.
   * @throws FidoError with `argument_error` for invalid ceremony options or
   *   routing conflicts, or when native callback execution fails.
   * @example
   * ```ts
   * await fido.authenticateForJourney(journey, { index: 0 });
   * ```
   */
  authenticateForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyAuthenticationOptions,
  ): Promise<FidoJourneyResult>;
  /**
   * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` registration collector.
   *
   * @param daVinci Active DaVinci instance.
   * @param options Optional registration ceremony options, including
   *   ceremony options; see {@link FidoRegistrationCeremonyOptions}.
   * @returns A promise that resolves to the WebAuthn attestation payload. Informational
   * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
   * @throws FidoError when the ceremony fails or the collector cannot be resolved.
   * @remarks
   * On ceremony failure the rejection carries `clientError`, the WebAuthn
   * DOMException name reported by the native collector (see
   * {@link FidoClientErrorName}). When `clientError` is defined, report the
   * failure to the server by advancing the flow with
   * `daVinci.next({ collectors: [] })` so the flow can branch on it; do not
   * submit the node's collectors, a `SUBMIT_BUTTON` shadows the FIDO error.
   * Without propagation the failure stays client-side and the server never
   * observes it. Resolution failures such as `FIDO_COLLECTOR_NOT_FOUND` carry
   * no `clientError` and must not be propagated.
   * @example
   * ```ts
   * try {
   *   await fido.registerForDaVinci(daVinci);
   * } catch (error) {
   *   const err = FidoError.from(error);
   *   if (err.clientError !== undefined) {
   *     // The collector classified the failure; submit it so the flow can branch.
   *     try {
   *       await daVinci.next({ collectors: [] });
   *     } catch (propagationError) {
   *       // Advancing the flow also failed; surface propagationError without
   *       // losing the original ceremony failure.
   *     }
   *   }
   *   throw err;
   * }
   * ```
   */
  registerForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciRegistrationOptions,
  ): Promise<FidoDaVinciResult>;
  /**
   * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` authentication collector.
   *
   * @param daVinci Active DaVinci instance.
   * @param options Optional authentication ceremony options, including
   *   ceremony options; see {@link FidoAuthenticationCeremonyOptions}.
   * @returns A promise that resolves to the WebAuthn assertion payload. Informational
   * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
   * @throws FidoError when the ceremony fails or the collector cannot be resolved.
   * @remarks
   * On ceremony failure the rejection carries `clientError`, the WebAuthn
   * DOMException name reported by the native collector (see
   * {@link FidoClientErrorName}). When `clientError` is defined, report the
   * failure to the server by advancing the flow with
   * `daVinci.next({ collectors: [] })` so the flow can branch on it; do not
   * submit the node's collectors, a `SUBMIT_BUTTON` shadows the FIDO error.
   * Without propagation the failure stays client-side and the server never
   * observes it. Resolution failures such as `FIDO_COLLECTOR_NOT_FOUND` carry
   * no `clientError` and must not be propagated.
   * @example
   * ```ts
   * try {
   *   await fido.authenticateForDaVinci(daVinci);
   * } catch (error) {
   *   const err = FidoError.from(error);
   *   if (err.clientError !== undefined) {
   *     // The collector classified the failure; submit it so the flow can branch.
   *     try {
   *       await daVinci.next({ collectors: [] });
   *     } catch (propagationError) {
   *       // Advancing the flow also failed; surface propagationError without
   *       // losing the original ceremony failure.
   *     }
   *   }
   *   throw err;
   * }
   * ```
   */
  authenticateForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciAuthenticationOptions,
  ): Promise<FidoDaVinciResult>;
}

/**
 * WebAuthn DOMException name reported by a failed DaVinci FIDO2 ceremony.
 *
 * @remarks
 * Surfaced on DaVinci FIDO rejections only, as {@link FidoError.clientError}.
 * Standalone and Journey FIDO rejections never carry it.
 *
 * Names are WebAuthn DOMException names as reported by the native collector.
 * Android reports an open set: androidx credential exceptions map to their
 * DOMException names, so any valid name can appear. iOS reports a closed set
 * of exactly the five names listed. For example, Android classifies a missing
 * credential as `UnknownError` while the bridge keeps the rejection `code` as
 * `FIDO_AUTHENTICATE_CANCELLED` in the DaVinci scope: `clientError` is the
 * server-parity value and the two fields can intentionally disagree.
 *
 * @public
 */
export type FidoClientErrorName =
  | 'NotAllowedError'
  | 'TimeoutError'
  | 'NotSupportedError'
  | 'InvalidStateError'
  | 'UnknownError'
  | (string & {});

/**
 * Error thrown when FIDO operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 *
 * On DaVinci ceremony failures, `clientError` carries the WebAuthn
 * DOMException name reported by the native collector; see
 * {@link FidoClientErrorName}.
 */
export class FidoError extends PingError {
  /**
   * WebAuthn DOMException name reported by the native DaVinci FIDO collector
   * when the ceremony failed, for example `'NotAllowedError'` after a user
   * cancellation.
   *
   * @remarks
   * Defined only on DaVinci ceremony failures that the native collector
   * classified; `undefined` for standalone and Journey rejections and for
   * resolution failures such as `FIDO_COLLECTOR_NOT_FOUND`. When defined, it
   * marks the failure as propagatable to the DaVinci server with
   * `daVinci.next({ collectors: [] })`. It is the server-parity value and can
   * intentionally disagree with `code`, which is the bridge-local
   * classification.
   */
  readonly clientError?: FidoClientErrorName;

  constructor(
    message: string,
    code: string,
    type: string,
    status?: number,
    clientError?: FidoClientErrorName,
  ) {
    super(message, code, type, status);
    this.name = 'FidoError';
    if (clientError !== undefined) this.clientError = clientError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): FidoError {
    if (raw instanceof FidoError) return raw;
    const normalizedError = PingError.from(raw);
    const rawRecord = raw as Record<string, unknown>;
    const userInfo =
      rawRecord?.userInfo && typeof rawRecord.userInfo === 'object'
        ? (rawRecord.userInfo as Record<string, unknown>)
        : null;
    const clientError =
      typeof userInfo?.clientError === 'string' &&
      userInfo.clientError.trim().length > 0
        ? userInfo.clientError
        : undefined;
    const fidoError = new FidoError(
      normalizedError.message,
      normalizedError.code,
      normalizedError.type,
      normalizedError.status,
      clientError,
    );
    if (raw instanceof Error && raw.stack) fidoError.stack = raw.stack;
    return fidoError;
  }
}

/**
 * Stable error codes emitted by the FIDO module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 *
 * `'FIDO_INVALID_PARAMETER'` is raised by the JavaScript facade with type
 * `'argument_error'` when caller input is invalid, before any native call is
 * made.
 */
export type FidoErrorCode =
  | 'FIDO_ERROR'
  | 'FIDO_REGISTER_ERROR'
  | 'FIDO_AUTHENTICATE_ERROR'
  | 'FIDO_AUTHENTICATE_CANCELLED'
  | 'FIDO_ACTIVITY_UNAVAILABLE'
  | 'FIDO_WINDOW_UNAVAILABLE'
  | 'FIDO_CALLBACK_NOT_FOUND'
  | 'FIDO_COLLECTOR_NOT_FOUND'
  | 'FIDO_INVALID_PARAMETER'
  | (string & {});

export type { DaVinciInstance, JourneyInstance };
