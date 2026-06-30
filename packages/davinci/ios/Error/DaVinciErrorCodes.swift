/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Stable DaVinci error code constants surfaced by iOS bridge rejections.
///
/// Keep these in sync with:
/// - JS `DaVinciErrorCode` union (`packages/davinci/src/types/error.types.ts`)
/// - Android `DaVinciErrorCodes`.
enum DaVinciErrorCodes: String {
  case configError = "DAVINCI_CONFIG_ERROR"
  case initError = "DAVINCI_INIT_ERROR"
  case startError = "DAVINCI_START_ERROR"
  case nextError = "DAVINCI_NEXT_ERROR"
  case collectorApplyError = "DAVINCI_COLLECTOR_APPLY_ERROR"
  case unsupportedCollectorError = "DAVINCI_UNSUPPORTED_COLLECTOR_ERROR"
  case sessionError = "DAVINCI_SESSION_ERROR"
  case logoutError = "DAVINCI_LOGOUT_ERROR"
  case disposeError = "DAVINCI_DISPOSE_ERROR"
  case argumentError = "DAVINCI_ARGUMENT_ERROR"
  case stateError = "DAVINCI_STATE_ERROR"
  case missingIntegrationError = "DAVINCI_MISSING_INTEGRATION_ERROR"
  case unknownError = "DAVINCI_UNKNOWN_ERROR"
}
