/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>

#if __has_include("RNPingDavinci-Swift.h")
#import "RNPingDavinci-Swift.h"
#else
#import <RNPingDavinci/RNPingDavinci-Swift.h>
#endif

/**
 * Classic (non-Turbo) React Native module for DaVinci operations.
 *
 * Keeps the DaVinci package compatible when TurboModule lookup is unavailable
 * at runtime.
 */
@interface RNPingDavinciClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingDavinciClassic

RCT_EXPORT_MODULE(RNPingDavinciClassic)

// Module init does not touch UIKit; main-thread hops are handled inside
// `withSwiftImpl:` per call, so RN does not need to set this module up on the
// main queue.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/**
 * Executes a block with the shared Swift implementation on the main thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 */
- (void)withSwiftImpl:(void (^)(RNPingDavinciImpl *impl))block
{
  if ([NSThread isMainThread]) {
    block([RNPingDavinciImpl shared]);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    block([RNPingDavinciImpl shared]);
  });
}

/// Configures one DaVinci client instance.
RCT_EXPORT_METHOD(configureDaVinci:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl configureDaVinci:config resolver:resolve rejecter:reject];
  }];
}

/// Starts a DaVinci flow.
RCT_EXPORT_METHOD(start:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl start:davinciId resolver:resolve rejecter:reject];
  }];
}

/// Submits collector input and advances to the next DaVinci node.
RCT_EXPORT_METHOD(next:(NSString *)davinciId
                  input:(NSDictionary *)input
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl next:davinciId input:input resolver:resolve rejecter:reject];
  }];
}

/// Returns session details for a DaVinci client.
RCT_EXPORT_METHOD(getSession:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl getSession:davinciId resolver:resolve rejecter:reject];
  }];
}

/// Refreshes active DaVinci user token set.
RCT_EXPORT_METHOD(refresh:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl refresh:davinciId resolver:resolve rejecter:reject];
  }];
}

/// Revokes active DaVinci user token set.
RCT_EXPORT_METHOD(revoke:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl revoke:davinciId
        resolver:^(BOOL value) {
          resolve(@(value));
        }
        rejecter:reject];
  }];
}

/// Resolves active DaVinci userinfo payload.
RCT_EXPORT_METHOD(userinfo:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl userinfo:davinciId resolver:resolve rejecter:reject];
  }];
}

/// Logs out the current DaVinci user.
RCT_EXPORT_METHOD(logout:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl logout:davinciId
        resolver:^{
          resolve([NSNull null]);
        }
        rejecter:reject];
  }];
}

/// Disposes native DaVinci state for one client.
RCT_EXPORT_METHOD(dispose:(NSString *)davinciId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingDavinciImpl *impl) {
    [impl dispose:davinciId
         resolver:^{
           resolve([NSNull null]);
         }
         rejecter:reject];
  }];
}

@end
