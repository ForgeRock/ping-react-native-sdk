/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import "RNPingProtect.h"

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingProtect-Swift.h")
#import "RNPingProtect-Swift.h"
#else
#import <RNPingProtect/RNPingProtect-Swift.h>
#endif

@implementation RNPingProtect
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingProtectImpl *)swiftImpl
{
  return [RNPingProtectImpl shared];
}

/**
 Runs Protect SDK data collection for the active ProtectCollector in a DaVinci flow.
 */
- (void)collectForDaVinci:(NSString *)davinciId
                  options:(NSDictionary *)options
                   config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] collectForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] collectForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Initializes the Protect SDK with the provided configuration.
 */
- (void)initialize:(NSDictionary *)protectConfig
      clientConfig:(NSDictionary *)clientConfig
           resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] initialize:protectConfig config:clientConfig resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] initialize:protectConfig config:clientConfig resolve:resolve rejecter:reject];
  });
}

/**
 Pauses behavioral data collection.
 */
- (void)pauseBehavioralData:(NSDictionary *)clientConfig
                    resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] pauseBehavioralData:clientConfig resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] pauseBehavioralData:clientConfig resolve:resolve rejecter:reject];
  });
}

/**
 Resumes behavioral data collection.
 */
- (void)resumeBehavioralData:(NSDictionary *)clientConfig
                     resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] resumeBehavioralData:clientConfig resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] resumeBehavioralData:clientConfig resolve:resolve rejecter:reject];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingProtectSpecJSI>(params);
}

@end
