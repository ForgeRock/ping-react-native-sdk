/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingDeviceClient-Swift.h")
#import "RNPingDeviceClient-Swift.h"
#else
#import <RNPingDeviceClient/RNPingDeviceClient-Swift.h>
#endif

/**
 * @interface RNPingDeviceClientClassic
 * @brief Classic (non-Turbo) React Native module for the Device Client.
 */
@interface RNPingDeviceClientClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingDeviceClientClassic

RCT_EXPORT_MODULE(RNPingDeviceClientClassic)

RCT_EXPORT_METHOD(create:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceClientImpl shared] create:config resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(get:(NSString *)handleId
                  deviceType:(NSString *)deviceType
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceClientImpl shared] get:handleId
                            deviceType:deviceType
                               resolve:resolve
                              rejecter:reject];
}

RCT_EXPORT_METHOD(update:(NSString *)handleId
                  deviceType:(NSString *)deviceType
                  device:(NSDictionary *)device
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceClientImpl shared] update:handleId
                               deviceType:deviceType
                                   device:device
                                  resolve:resolve
                                 rejecter:reject];
}

RCT_EXPORT_METHOD(deleteDevice:(NSString *)handleId
                  deviceType:(NSString *)deviceType
                  device:(NSDictionary *)device
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceClientImpl shared] deleteDevice:handleId
                                     deviceType:deviceType
                                         device:device
                                        resolve:resolve
                                       rejecter:reject];
}

RCT_EXPORT_METHOD(dispose:(NSString *)handleId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingDeviceClientImpl shared] dispose:handleId resolve:resolve rejecter:reject];
}

@end
