/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** Internal DeviceEventEmitter event names used by the RNPingPush bridge. */
export const PushEvents = {
  FCM_TOKEN_RECEIVED: 'com.pingidentity.rnpush.FCMTokenReceived',
  APNS_TOKEN_RECEIVED: 'com.pingidentity.rnpush.APNsTokenReceived',
  PUSH_MESSAGE_RECEIVED: 'com.pingidentity.rnpush.PushMessageReceived',
} as const;
