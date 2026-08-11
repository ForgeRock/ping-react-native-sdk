/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingProtect-Swift.h")
#import "RNPingProtect-Swift.h"
#else
#import <RNPingProtect/RNPingProtect-Swift.h>
#endif

/**
 * Classic bridge module used when React Native New Architecture is disabled.
 */
@interface RNPingProtectClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingProtectClassic

RCT_EXPORT_MODULE(RNPingProtectClassic)

/**
 * Executes a block with the shared Swift implementation on the main thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 */
- (void)withSwiftImpl:(void (^)(RNPingProtectImpl *impl))block
{
  if ([NSThread isMainThread]) {
    block([RNPingProtectImpl shared]);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    block([RNPingProtectImpl shared]);
  });
}

/**
 * Runs Protect SDK data collection for the active ProtectCollector in a DaVinci flow.
 */
RCT_EXPORT_METHOD(collectForDaVinci:(NSString *)davinciId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingProtectImpl *impl) {
    [impl collectForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Initializes the Protect SDK with the provided configuration.
 */
RCT_EXPORT_METHOD(initialize:(NSDictionary *)protectConfig
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingProtectImpl *impl) {
    [impl initialize:protectConfig config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Pauses behavioral data collection.
 */
RCT_EXPORT_METHOD(pauseBehavioralData:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingProtectImpl *impl) {
    [impl pauseBehavioralData:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Resumes behavioral data collection.
 */
RCT_EXPORT_METHOD(resumeBehavioralData:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingProtectImpl *impl) {
    [impl resumeBehavioralData:config resolve:resolve rejecter:reject];
  }];
}

@end
