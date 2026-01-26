/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingDeviceId.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingDeviceId-Swift.h"

@implementation RNPingDeviceId
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingDeviceIdImpl *)swiftImpl
{
  return [RNPingDeviceIdImpl shared];
}

/**
 Returns the default keychain-backed device identifier.
 */
- (void)getDefaultDeviceId:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getDefaultDeviceId:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingDeviceIdSpecJSI>(params);
}

@end
