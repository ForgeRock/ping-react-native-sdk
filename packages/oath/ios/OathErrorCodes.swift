/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Stable error codes emitted by the OATH module.
///
/// Keep these in sync with JS `OathErrorCodes` and Android
/// `OathErrorCodes`. Each case maps to a unique string that JS
/// consumers can match on to provide user-facing error handling.
internal enum OathErrorCodes: String {
  /// The requested credential was not found in storage.
  case credentialNotFound = "OATH_CREDENTIAL_NOT_FOUND"
  /// The credential is locked and cannot be used without authentication.
  case credentialLocked = "OATH_CREDENTIAL_LOCKED"
  /// A credential with the same identifier already exists.
  case duplicateCredential = "OATH_DUPLICATE_CREDENTIAL"
  /// The provided URI is not a valid OATH URI.
  case invalidUri = "OATH_INVALID_URI"
  /// A required parameter is missing from the request.
  case missingParameter = "OATH_MISSING_PARAMETER"
  /// A provided parameter has an invalid value.
  case invalidParameter = "OATH_INVALID_PARAMETER"
  /// The URI could not be formatted or parsed correctly.
  case uriFormatting = "OATH_URI_FORMATTING"
  /// OATH code generation failed for the credential.
  case codeGenerationFailed = "OATH_CODE_GENERATION_FAILED"
  /// The operation violates an OATH policy constraint.
  case policyViolation = "OATH_POLICY_VIOLATION"
  /// The OATH client failed to initialize.
  case initializationFailed = "OATH_INITIALIZATION_FAILED"
  /// The cleanup operation failed.
  case cleanupFailed = "OATH_CLEANUP_FAILED"
  /// A storage operation failed.
  case storageFailed = "OATH_STORAGE_FAILURE"
  /// The credential storage is corrupted.
  case storageCorrupted = "OATH_STORAGE_CORRUPTED"
  /// Access to the credential storage was denied.
  case storageAccessDenied = "OATH_STORAGE_ACCESS_DENIED"
  /// An unexpected state was encountered.
  case stateError = "OATH_STATE_ERROR"
  /// A generic, unclassified error.
  case unknown = "OATH_UNKNOWN_ERROR"
}
