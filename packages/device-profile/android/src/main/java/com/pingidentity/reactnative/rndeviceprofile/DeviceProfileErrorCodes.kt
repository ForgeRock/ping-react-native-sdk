/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rndeviceprofile

/**
 * Stable error codes emitted by the Device Profile module.
 *
 * @remarks
 * Keep these in sync with JS `DeviceProfileErrorCode` and iOS `DeviceProfileErrorCode`.
 */
object DeviceProfileErrorCodes {
  const val DEVICE_PROFILE_LOCATION_UNAVAILABLE = "DEVICE_PROFILE_LOCATION_UNAVAILABLE"
  const val DEVICE_PROFILE_CALLBACK_NOT_FOUND = "DEVICE_PROFILE_CALLBACK_NOT_FOUND"
  const val DEVICE_PROFILE_COLLECT_ERROR = "DEVICE_PROFILE_COLLECT_ERROR"
}
