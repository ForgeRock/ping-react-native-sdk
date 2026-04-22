/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingDeviceClient.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingDeviceClient-Swift.h"

@implementation RNPingDeviceClient
RCT_EXPORT_MODULE()

- (RNPingDeviceClientImpl *)swiftImpl
{
  return [RNPingDeviceClientImpl shared];
}

- (void)create:(NSDictionary *)config
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] create:config resolve:resolve rejecter:reject];
}

- (void)get:(NSString *)handleId
 deviceType:(NSString *)deviceType
    resolve:(RCTPromiseResolveBlock)resolve
     reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] get:handleId deviceType:deviceType resolve:resolve rejecter:reject];
}

- (void)update:(NSString *)handleId
    deviceType:(NSString *)deviceType
        device:(NSDictionary *)device
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] update:handleId
                deviceType:deviceType
                    device:device
                   resolve:resolve
                  rejecter:reject];
}

- (void)deleteDevice:(NSString *)handleId
          deviceType:(NSString *)deviceType
              device:(NSDictionary *)device
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deleteDevice:handleId
                      deviceType:deviceType
                          device:device
                         resolve:resolve
                        rejecter:reject];
}

- (void)dispose:(NSString *)handleId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] dispose:handleId resolve:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingDeviceClientSpecJSI>(params);
}

@end
