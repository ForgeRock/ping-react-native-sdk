/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import "RNPingDeviceProfile.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#if __has_include("RNPingDeviceProfile-Swift.h")
#import "RNPingDeviceProfile-Swift.h"
#else
#import <RNPingDeviceProfile/RNPingDeviceProfile-Swift.h>
#endif

@implementation RNPingDeviceProfile
RCT_EXPORT_MODULE()

/**
 * Accessor for the shared Swift implementation instance.
 */
- (RNPingDeviceProfileImpl *)swiftImpl
{
  return [RNPingDeviceProfileImpl shared];
}

/**
 * Collects device profile data based on the requested collectors.
 *
 * @param collectors Array of strings representing the data to collect (e.g., "platform", "hardware").
 * @param includeModelName Whether the iOS platform collector resolves the readable device name.
 * @param resolve Promise resolve block.
 * @param reject Promise reject block.
 */
- (void)collectDeviceProfile:(NSArray<NSString *> *)collectors
            includeModelName:(BOOL)includeModelName
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] collectDeviceProfile:collectors
                       includeModelName:includeModelName
                                 resolver:resolve
                                 rejecter:reject];
}

/**
 * Collects device profile data for a specific journey.
 *
 * @param journeyId The ID of the journey to associate the collection with.
 * @param collectors Array of strings representing the data to collect.
 * @param loggerId Optional native logger handle id.
 * @param includeModelName Whether the iOS platform collector resolves the readable device name.
 * @param resolve Promise resolve block.
 * @param reject Promise reject block.
 */
- (void)collectDeviceProfileForJourney:(NSString *)journeyId
                            collectors:(NSArray<NSString *> *)collectors
                              loggerId:(NSString *)loggerId
                      includeModelName:(BOOL)includeModelName
                                resolve:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] collectDeviceProfileForJourney:journeyId
                                        collectors:collectors
                                          loggerId:loggerId
                                  includeModelName:includeModelName
                                            resolver:resolve
                                            rejecter:reject];
}

/**
 * TurboModule support method.
 */
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingDeviceProfileSpecJSI>(params);
}

@end
