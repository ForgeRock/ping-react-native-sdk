/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingDeviceId-Swift.h")
#import "RNPingDeviceId-Swift.h"
#else
#import <RNPingDeviceId/RNPingDeviceId-Swift.h>
#endif

/**
 * @interface RNPingDeviceIdClassic
 * @brief Classic (non-Turbo) React Native module for Device ID.
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingDeviceIdClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingDeviceIdClassic
 * @brief Implementation of the classic device ID bridge module.
 */
@implementation RNPingDeviceIdClassic

RCT_EXPORT_MODULE(RNPingDeviceId)

#pragma mark - Default Device ID

/**
 * Returns the default keychain-backed device identifier.
 */
RCT_EXPORT_METHOD(getDefaultDeviceId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceIdImpl shared] getDefaultDeviceId:resolve rejecter:reject];
}

@end
