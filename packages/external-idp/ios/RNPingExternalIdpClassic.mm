/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingExternalIdp-Swift.h")
#import "RNPingExternalIdp-Swift.h"
#else
#import <RNPingExternalIdp/RNPingExternalIdp-Swift.h>
#endif

/**
 * Classic bridge module used when React Native New Architecture is disabled.
 */
@interface RNPingExternalIdpClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingExternalIdpClassic

RCT_EXPORT_MODULE(RNPingExternalIdpClassic)

/**
 * Executes a block with the shared Swift implementation on the main thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 */
- (void)withSwiftImpl:(void (^)(RNPingExternalIdpImpl *impl))block
{
  if ([NSThread isMainThread]) {
    block([RNPingExternalIdpImpl shared]);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    block([RNPingExternalIdpImpl shared]);
  });
}

/**
 * Launches the external IdP authorization flow for an active Journey callback.
 */
RCT_EXPORT_METHOD(authorizeForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingExternalIdpImpl *impl) {
    [impl authorizeForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Mutates the native SelectIdpCallback state for an active Journey callback.
 */
RCT_EXPORT_METHOD(selectProviderForJourney:(NSString *)journeyId
                  provider:(NSString *)provider
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingExternalIdpImpl *impl) {
    [impl selectProviderForJourney:journeyId provider:provider options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Launches the external IdP authorization flow for an active DaVinci collector.
 */
RCT_EXPORT_METHOD(authorizeForDaVinci:(NSString *)davinciId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingExternalIdpImpl *impl) {
    [impl authorizeForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  }];
}

@end
