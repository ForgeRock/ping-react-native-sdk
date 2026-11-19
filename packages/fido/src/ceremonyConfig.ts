/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { Platform } from 'react-native';
import type { LoggerInstance } from '@ping-identity/rn-types';
import { FidoError } from './types';
import type {
  FidoAuthenticationCeremonyOptions,
  FidoNativeCeremonyConfig,
  FidoRegistrationCeremonyOptions,
} from './types';

/**
 * The FIDO ceremony a bridge call drives.
 */
export type FidoCeremony = 'registration' | 'authentication';

/**
 * Native configuration payload sent over the bridge for one FIDO ceremony.
 */
export type NativeFidoCeremonyConfig = {
  /** Optional native logger handle id resolved by JavaScript. */
  loggerId?: string;
  /**
   * Optional API routing flag; present only when a per-call or client-level
   * flag exists. Absent lets native auto-detection decide.
   */
  useFido2ApiClient?: boolean;
  /** Optional top-level credential preference read on both platforms. */
  preferImmediatelyAvailableCredentials?: boolean;
  /** Optional Android-only ceremony blocks. */
  android?: {
    /** Optional Credential Manager overrides for the ceremony. */
    credentialManager?: Record<string, unknown>;
    /** Optional Play Services overrides for the ceremony. */
    playServices?: Record<string, unknown>;
  };
};

const ANDROID_KEY = 'android';
const CREDENTIAL_MANAGER_KEY = 'credentialManager';
const PLAY_SERVICES_KEY = 'playServices';
const USE_FIDO2_API_CLIENT_KEY = 'useFido2ApiClient';

const REGISTRATION_ANDROID_KEYS = new Set([
  CREDENTIAL_MANAGER_KEY,
  PLAY_SERVICES_KEY,
]);

const AUTHENTICATION_ANDROID_KEYS = new Set([
  USE_FIDO2_API_CLIENT_KEY,
  CREDENTIAL_MANAGER_KEY,
  PLAY_SERVICES_KEY,
]);

/**
 * Describes a JavaScript value the way the option warnings report it: type
 * name plus, for strings, the length. Never the value itself.
 */
function describeValueType(value: unknown): string {
  if (typeof value === 'string') {
    return `a String of length ${value.length}`;
  }
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an Array';
  if (typeof value === 'object') return 'an Object';
  if (typeof value === 'boolean') return 'a Boolean';
  if (typeof value === 'number') return 'a Number';
  return `a value of type ${typeof value}`;
}

/**
 * Emits an option warning naming the key and the value type; never the value.
 */
function warnOption(
  logger: LoggerInstance,
  key: string,
  value: unknown,
  consequence: string,
): void {
  logger.warn(
    `FIDO config key '${key}' received ${describeValueType(value)}; ${consequence}`,
  );
}

/**
 * Returns the ceremony Android block when it is a plain object, or null after
 * warning.
 */
function readAndroidBlock(
  logger: LoggerInstance,
  ceremonyOptions:
    | FidoRegistrationCeremonyOptions
    | FidoAuthenticationCeremonyOptions
    | undefined,
): Record<string, unknown> | null {
  const block = ceremonyOptions?.android;
  if (block === undefined) return null;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    warnOption(
      logger,
      ANDROID_KEY,
      block,
      'an Object is expected and the block is ignored',
    );
    return null;
  }
  return block as Record<string, unknown>;
}

/**
 * Copies one nested ceremony block through shallow key checks, warning for
 * keys the ceremony does not accept.
 *
 * @param logger Logger used for warnings.
 * @param parentKey Dotted key path of the block in warning messages.
 * @param block Block being copied.
 * @param knownKeys Keys copied from this block; other keys warn as
 *   unrecognized and are dropped.
 * @returns A shallow copy without the unknown keys, or null when the block is
 *   not a plain object.
 */
function copyBlockWithKeyCheck(
  logger: LoggerInstance,
  parentKey: string,
  block: unknown,
  knownKeys: Set<string>,
): Record<string, unknown> | null {
  if (block === undefined) return null;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    warnOption(
      logger,
      parentKey,
      block,
      'an Object is expected and the block is ignored',
    );
    return null;
  }
  const source = block as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (knownKeys.has(key)) {
      copy[key] = source[key];
    } else {
      warnOption(
        logger,
        `${parentKey}.${key}`,
        source[key],
        'this key is not recognized and is ignored',
      );
    }
  }
  return copy;
}

/**
 * Returns an Android ceremony sub-block when it is a plain object; otherwise
 * warns, deletes it from the block, and returns undefined, mirroring native,
 * which reads a non-map option child as absent instead of failing.
 *
 * @param logger Logger used for warnings.
 * @param block Android block holding the sub-block; the sub-block key is
 *   deleted from it when ignored so the pruned block stays consistent.
 * @param key Sub-block key within `block`.
 * @returns The plain-object sub-block, or undefined when absent or ignored.
 */
function readAndroidChildBlock(
  logger: LoggerInstance,
  block: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = block[key];
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    warnOption(
      logger,
      `${ANDROID_KEY}.${key}`,
      value,
      'an Object is expected and the block is ignored',
    );
    delete block[key];
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * Validates a base64url string with the same acceptance set as the JDK
 * Base64 URL decoder on Android: unpadded input is accepted when its length
 * is 0, 2, or 3 mod 4 (never 1), and padded input must carry exactly the
 * canonical padding for its data length. The empty string is rejected as a
 * caller mistake.
 */
function isBase64Url(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  const padded = /^([A-Za-z0-9_-]*)(={0,2})$/.exec(value);
  if (!padded) {
    return false;
  }
  const dataLen = (padded[1] ?? '').length;
  const padLen = (padded[2] ?? '').length;
  if (dataLen % 4 === 1) {
    return false;
  }
  if (padLen === 0) {
    return true;
  }
  return padLen === (4 - (dataLen % 4)) % 4;
}

/**
 * Validates a flattened Android component name (`package/class`).
 */
function isComponentName(value: string): boolean {
  return /^[^/]+\/[^/]+$/.test(value);
}

/**
 * Builds the error thrown for invalid caller input, before any native call.
 */
function argumentError(message: string): FidoError {
  return new FidoError(message, 'FIDO_INVALID_PARAMETER', 'argument_error');
}

/**
 * Validates the optional `requestJson` of a Credential Manager block.
 */
function validateRequestJson(block: Record<string, unknown>): void {
  const requestJson = block.requestJson;
  if (
    requestJson !== undefined &&
    requestJson !== null &&
    !isPlainRecord(requestJson)
  ) {
    throw argumentError(
      `[@ping-identity/rn-fido] android.credentialManager.requestJson must be an object (received ${describeValueType(requestJson)}).`,
    );
  }
}

/**
 * Validates the optional `clientDataHash` of a Credential Manager block.
 */
function validateClientDataHash(block: Record<string, unknown>): void {
  const clientDataHash = block.clientDataHash;
  if (
    clientDataHash !== undefined &&
    (typeof clientDataHash !== 'string' || !isBase64Url(clientDataHash))
  ) {
    throw argumentError(
      `[@ping-identity/rn-fido] android.credentialManager.clientDataHash must be a base64url string (received ${describeValueType(clientDataHash)}).`,
    );
  }
}

/**
 * Validates the registration Credential Manager create-request overrides.
 *
 * @throws FidoError with `argument_error` on invalid value types, a bad
 *   base64url `clientDataHash`, a bad `preferDefaultProvider` component name,
 *   or `preferDefaultProvider` combined with `isConditional: true`.
 */
function validateRegistrationCredentialManager(
  block: Record<string, unknown>,
): Record<string, unknown> {
  validateRequestJson(block);
  validateClientDataHash(block);
  const preferDefaultProvider = block.preferDefaultProvider;
  if (preferDefaultProvider !== undefined) {
    if (
      typeof preferDefaultProvider !== 'string' ||
      !isComponentName(preferDefaultProvider)
    ) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.credentialManager.preferDefaultProvider must be a "package/class" component name (received ${describeValueType(preferDefaultProvider)}).`,
      );
    }
  }
  if (
    block.preferDefaultProvider !== undefined &&
    block.isConditional === true
  ) {
    throw argumentError(
      '[@ping-identity/rn-fido] android.credentialManager.preferDefaultProvider cannot be combined with isConditional set to true.',
    );
  }
  const origin = block.origin;
  if (origin !== undefined && typeof origin !== 'string') {
    throw argumentError(
      `[@ping-identity/rn-fido] android.credentialManager.origin must be a string (received ${describeValueType(origin)}).`,
    );
  }
  for (const key of [
    'preferImmediatelyAvailableCredentials',
    'isAutoSelectAllowed',
    'isConditional',
  ] as const) {
    const flag = block[key];
    if (flag !== undefined && typeof flag !== 'boolean') {
      throw argumentError(
        `[@ping-identity/rn-fido] android.credentialManager.${key} must be a boolean (received ${describeValueType(flag)}).`,
      );
    }
  }
  return block;
}

/**
 * Returns true when the value is a plain JSON-style record.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

/**
 * Validates the authentication Credential Manager sign-in overrides.
 *
 * @throws FidoError with `argument_error` on invalid value types, a bad
 *   base64url `clientDataHash`, or bad `allowedProviders` entries.
 */
function validateAuthenticationCredentialManager(
  block: Record<string, unknown>,
): Record<string, unknown> {
  validateRequestJson(block);
  validateClientDataHash(block);
  const allowedProviders = block.allowedProviders;
  if (allowedProviders !== undefined) {
    if (!Array.isArray(allowedProviders)) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.credentialManager.allowedProviders must be an array of "package/class" strings (received ${describeValueType(allowedProviders)}).`,
      );
    }
    for (const provider of allowedProviders) {
      if (typeof provider !== 'string' || !isComponentName(provider)) {
        throw argumentError(
          `[@ping-identity/rn-fido] android.credentialManager.allowedProviders entries must be "package/class" strings (received ${describeValueType(provider)}).`,
        );
      }
    }
  }
  return block;
}

/**
 * Validates the authentication Play Services request overrides.
 *
 * @throws FidoError with `argument_error` on invalid value types, a
 *   non-positive or non-finite `timeoutSeconds`, or a non-integer `requestId`.
 */
function validatePlayServices(
  block: Record<string, unknown>,
): Record<string, unknown> {
  const timeoutSeconds = block.timeoutSeconds;
  if (timeoutSeconds !== undefined) {
    if (
      typeof timeoutSeconds !== 'number' ||
      !Number.isFinite(timeoutSeconds) ||
      timeoutSeconds <= 0
    ) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.timeoutSeconds must be a positive finite number (received ${describeValueType(timeoutSeconds)}).`,
      );
    }
  }
  const requestId = block.requestId;
  if (requestId !== undefined) {
    if (
      typeof requestId !== 'number' ||
      !Number.isInteger(requestId) ||
      requestId < -2147483648 ||
      requestId > 2147483647
    ) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.requestId must be a 32-bit integer (received ${describeValueType(requestId)}).`,
      );
    }
  }
  const transports = block.transports;
  if (transports !== undefined) {
    if (
      !Array.isArray(transports) ||
      transports.some((name) => typeof name !== 'string')
    ) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.transports must be an array of strings (received ${describeValueType(transports)}).`,
      );
    }
  }
  const extensions = block.authenticationExtensions;
  if (extensions !== undefined) {
    if (!isPlainRecord(extensions)) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.authenticationExtensions must be an object (received ${describeValueType(extensions)}).`,
      );
    }
    const fidoAppId = extensions.fidoAppId;
    if (fidoAppId !== undefined && typeof fidoAppId !== 'string') {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.authenticationExtensions.fidoAppId must be a string (received ${describeValueType(fidoAppId)}).`,
      );
    }
    const userVerificationMethod = extensions.userVerificationMethod;
    if (
      userVerificationMethod !== undefined &&
      typeof userVerificationMethod !== 'boolean'
    ) {
      throw argumentError(
        `[@ping-identity/rn-fido] android.playServices.authenticationExtensions.userVerificationMethod must be a boolean (received ${describeValueType(userVerificationMethod)}).`,
      );
    }
  }
  return block;
}

/**
 * Reads and validates the per-call `android.useFido2ApiClient` flag and removes
 * it from the block, since it travels as a top-level native key.
 *
 * @throws FidoError with `argument_error` when the value is not a boolean.
 */
function takeAuthenticationRoutingFlag(
  block: Record<string, unknown>,
): boolean | undefined {
  const flag = block[USE_FIDO2_API_CLIENT_KEY];
  if (flag === undefined) return undefined;
  delete block[USE_FIDO2_API_CLIENT_KEY];
  if (typeof flag !== 'boolean') {
    throw argumentError(
      `[@ping-identity/rn-fido] ${ANDROID_KEY}.${USE_FIDO2_API_CLIENT_KEY} must be a boolean (received ${describeValueType(flag)}).`,
    );
  }
  return flag;
}

/**
 * Builds the native configuration payload for one FIDO ceremony.
 *
 * Composes the immutable client-level configuration with the ceremony options
 * and returns a fresh object on every call, so one call never leaks into
 * another. Argument errors throw before any native call.
 *
 * @param resolvedConfig Client-level configuration captured by
 *   `createFidoClient`; never mutated.
 * @param ceremony Ceremony the call drives.
 * @param ceremonyOptions Optional ceremony-level options.
 * @param logger Logger used for pruning warnings.
 * @returns A fresh native configuration object.
 * @throws FidoError with `argument_error` for caller mistakes: ceremony
 *   options that are not an object, wrong value types, a non-boolean per-call
 *   `android.useFido2ApiClient`,
 *   `preferDefaultProvider` combined with `isConditional: true`, a bad
 *   base64url `clientDataHash`, or a bad `package/class` component name.
 * @remarks
 * Platform pruning follows native: on iOS the whole `android` block is
 * removed with a warning; on Android, registration removes the
 * `playServices` block with a warning and authentication warns for unknown
 * block keys. `useFido2ApiClient` is emitted on Android only, as the
 * per-call `android.useFido2ApiClient` when defined, else the client-level
 * flag; iOS omits the key because native there does not recognize it.
 * Without either flag the key is omitted and native auto-detects the route.
 * The blocks never change the route; native applies the block for the
 * selected route and reports the other. Android applies
 * `preferImmediatelyAvailableCredentials` to registration only and logs it as
 * unsupported on authentication, while iOS applies it to authentication only
 * and reports it on registration; the value is forwarded on both ceremonies
 * and the platform mismatch is reported natively.
 */
export function buildNativeConfig(
  resolvedConfig: FidoNativeCeremonyConfig,
  ceremony: FidoCeremony,
  ceremonyOptions:
    | FidoRegistrationCeremonyOptions
    | FidoAuthenticationCeremonyOptions
    | undefined,
  logger: LoggerInstance,
): NativeFidoCeremonyConfig {
  if (
    ceremonyOptions !== undefined &&
    (ceremonyOptions === null ||
      typeof ceremonyOptions !== 'object' ||
      Array.isArray(ceremonyOptions))
  ) {
    throw argumentError(
      `[@ping-identity/rn-fido] Ceremony options must be an object (received ${describeValueType(ceremonyOptions)}).`,
    );
  }

  const config: NativeFidoCeremonyConfig = {
    loggerId: resolvedConfig.loggerId,
  };
  if (resolvedConfig.loggerId === undefined) delete config.loggerId;

  const ceremonyFlag = ceremonyOptions?.preferImmediatelyAvailableCredentials;
  if (typeof ceremonyFlag !== 'undefined') {
    if (typeof ceremonyFlag !== 'boolean') {
      throw argumentError(
        `[@ping-identity/rn-fido] preferImmediatelyAvailableCredentials must be a boolean (received ${describeValueType(ceremonyFlag)}).`,
      );
    }
    config.preferImmediatelyAvailableCredentials = ceremonyFlag;
  }

  if (ceremonyOptions !== undefined) {
    const knownTopLevelKeys = new Set([
      'preferImmediatelyAvailableCredentials',
      ANDROID_KEY,
    ]);
    for (const key of Object.keys(ceremonyOptions)) {
      if (!knownTopLevelKeys.has(key)) {
        warnOption(
          logger,
          key,
          (ceremonyOptions as Record<string, unknown>)[key],
          'this key is not recognized and is ignored',
        );
      }
    }
  }

  const androidBlock = readAndroidBlock(logger, ceremonyOptions);
  let perCallUseFido2ApiClient: boolean | undefined;

  if (Platform.OS === 'android' && androidBlock !== null) {
    const pruned = copyBlockWithKeyCheck(
      logger,
      ANDROID_KEY,
      androidBlock,
      ceremony === 'registration'
        ? REGISTRATION_ANDROID_KEYS
        : AUTHENTICATION_ANDROID_KEYS,
    );
    if (pruned !== null) {
      const credentialManager = readAndroidChildBlock(
        logger,
        pruned,
        CREDENTIAL_MANAGER_KEY,
      );
      if (ceremony === 'registration') {
        // Registration reports any playServices value with the registration
        // consequence and drops it, including non-object values.
        const playServices = pruned[PLAY_SERVICES_KEY];
        if (playServices !== undefined) {
          warnOption(
            logger,
            `${ANDROID_KEY}.${PLAY_SERVICES_KEY}`,
            playServices,
            'registration uses Credential Manager and this block is ignored',
          );
          delete pruned[PLAY_SERVICES_KEY];
        }
        if (credentialManager !== undefined) {
          validateRegistrationCredentialManager(credentialManager);
        }
      } else {
        const playServices = readAndroidChildBlock(
          logger,
          pruned,
          PLAY_SERVICES_KEY,
        );
        perCallUseFido2ApiClient = takeAuthenticationRoutingFlag(pruned);
        if (credentialManager !== undefined) {
          validateAuthenticationCredentialManager(credentialManager);
        }
        if (playServices !== undefined) {
          validatePlayServices(playServices);
        }
      }
      if (Object.keys(pruned).length > 0) {
        config.android = pruned;
      }
    }
  } else if (Platform.OS !== 'android' && androidBlock !== null) {
    warnOption(
      logger,
      ANDROID_KEY,
      androidBlock,
      'Android-only options are ignored on iOS',
    );
  }

  // iOS native does not recognize this key and warns for unknown keys, so it
  // is emitted on Android only; native registration does not read it.
  const useFido2ApiClient =
    perCallUseFido2ApiClient ?? resolvedConfig.useFido2ApiClient;
  if (Platform.OS === 'android' && useFido2ApiClient !== undefined) {
    config.useFido2ApiClient = useFido2ApiClient;
  }

  return config;
}
