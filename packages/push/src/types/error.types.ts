/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError } from '@ping-identity/rn-types';

/**
 * Stable error codes emitted by the Push module.
 *
 * @remarks
 * Widened with `| (string & {})` for semver safety — future error codes added
 * by the native SDKs remain assignable without a breaking change.
 *
 * Keep these in sync with native error constants on both iOS and Android.
 *
 * | Code | Meaning |
 * |------|---------|
 * | `'not_initialized'` | Client was not initialized before calling a method. |
 * | `'initialization_failed'` | Native `PushClient` initialization failed. |
 * | `'invalid_uri'` | The enrollment URI is not a valid `pushauth://` URI. |
 * | `'missing_required_parameter'` | A required field is absent from the payload. |
 * | `'invalid_parameter_value'` | A field value is outside the allowed range. |
 * | `'invalid_push_type'` | The push type string in the payload is unrecognized. |
 * | `'invalid_platform'` | The platform string in the payload is unrecognized. |
 * | `'storage_failure'` | Credential or notification storage operation failed. |
 * | `'device_token_not_set'` | No device token has been registered with the service. |
 * | `'no_handler_for_platform'` | No push handler is registered for the payload's platform. |
 * | `'message_parsing_failed'` | Incoming push payload could not be parsed. |
 * | `'credential_not_found'` | The requested credential does not exist. |
 * | `'credential_locked'` | The credential is locked and cannot be used. |
 * | `'duplicate_credential'` | A credential with the same identifier already exists. |
 * | `'notification_not_found'` | The requested notification does not exist or has expired. |
 * | `'policy_violation'` | The operation violates a credential or account policy. |
 * | `'registration_failed'` | Device registration with the push service failed. |
 * | `'network_failure'` | A network error occurred communicating with the push service. |
 */
export type PushErrorCode =
  | 'not_initialized'
  | 'initialization_failed'
  | 'invalid_uri'
  | 'missing_required_parameter'
  | 'invalid_parameter_value'
  | 'invalid_push_type'
  | 'invalid_platform'
  | 'storage_failure'
  | 'device_token_not_set'
  | 'no_handler_for_platform'
  | 'message_parsing_failed'
  | 'credential_not_found'
  | 'credential_locked'
  | 'duplicate_credential'
  | 'notification_not_found'
  | 'policy_violation'
  | 'registration_failed'
  | 'network_failure'
  | (string & {});

/**
 * Error payload returned when Push operations fail.
 *
 * @remarks
 * All rejections from {@link PushClient} methods use this shape.
 * The `error` field contains one of the {@link PushErrorCode} strings
 * for programmatic error handling.
 *
 * @example
 * ```ts
 * try {
 *   await client.addCredentialFromUri(uri);
 * } catch (err) {
 *   const pushError = err as PushError;
 *   if (pushError.error === 'invalid_uri') {
 *     // handle invalid URI
 *   }
 * }
 * ```
 */
export type PushError = GenericError;
