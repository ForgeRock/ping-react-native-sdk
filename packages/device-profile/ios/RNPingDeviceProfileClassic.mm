/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <React/RCTBridgeModule.h>
#import "RNPingDeviceProfile-Swift.h"

/// React Native bridge module for classic (non-TurboModule) access.
@interface RNPingDeviceProfileClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingDeviceProfileClassic

RCT_EXPORT_MODULE(RNPingDeviceProfileClassic)

/// Collects device profile data outside of Journey flows.
RCT_EXPORT_METHOD(collectDeviceProfile:(NSArray<NSString *> *)collectors
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [RNPingDeviceProfileCommon collectDeviceProfile:collectors resolver:resolve rejecter:reject];
}

/// Collects device profile data using the active Journey callback context.
RCT_EXPORT_METHOD(collectDeviceProfileForJourney:(NSString *)journeyId
                  collectors:(NSArray<NSString *> *)collectors
                  loggerId:(NSString * _Nullable)loggerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [RNPingDeviceProfileCommon collectDeviceProfileForJourney:journeyId
                                               collectors:collectors
                                                 loggerId:loggerId
                                                  resolver:resolve
                                                  rejecter:reject];
}

@end
