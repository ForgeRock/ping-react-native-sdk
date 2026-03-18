/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Stable Journey error codes surfaced by iOS bridge rejections.
///
/// Keep these in sync with:
/// - JS `JourneyErrorCode` union (`packages/journey/src/types/error.types.ts`)
/// - Android `JourneyErrorCodes`.
enum JourneyErrorCodes: String {
  case configError = "JOURNEY_CONFIG_ERROR"
  case initError = "JOURNEY_INIT_ERROR"
  case startError = "JOURNEY_START_ERROR"
  case nextError = "JOURNEY_NEXT_ERROR"
  case resumeError = "JOURNEY_RESUME_ERROR"
  case userError = "JOURNEY_USER_ERROR"
  case logoutError = "JOURNEY_LOGOUT_ERROR"
  case disposeError = "JOURNEY_DISPOSE_ERROR"
  case stateError = "JOURNEY_STATE_ERROR"
  case callbackApplyError = "JOURNEY_CALLBACK_APPLY_ERROR"
  case unsupportedCallbackError = "JOURNEY_UNSUPPORTED_CALLBACK_ERROR"
  case missingIntegrationError = "JOURNEY_MISSING_INTEGRATION_ERROR"
}

