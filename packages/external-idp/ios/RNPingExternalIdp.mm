/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import "RNPingExternalIdp.h"

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingExternalIdp-Swift.h")
#import "RNPingExternalIdp-Swift.h"
#else
#import <RNPingExternalIdp/RNPingExternalIdp-Swift.h>
#endif

@implementation RNPingExternalIdp
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingExternalIdpImpl *)swiftImpl
{
  return [RNPingExternalIdpImpl shared];
}

/**
 Launches the external IdP authorization flow for an active Journey callback.
 */
- (void)authorizeForJourney:(NSString *)journeyId
                    options:(NSDictionary *)options
                     config:(NSDictionary *)config
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)rejecter
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] authorizeForJourney:journeyId options:options config:config resolve:resolve rejecter:rejecter];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] authorizeForJourney:journeyId options:options config:config resolve:resolve rejecter:rejecter];
  });
}

/**
 Mutates the native SelectIdpCallback state for an active Journey callback.
 */
- (void)selectProviderForJourney:(NSString *)journeyId
                        provider:(NSString *)provider
                         options:(NSDictionary *)options
                          config:(NSDictionary *)config
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)rejecter
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] selectProviderForJourney:journeyId provider:provider options:options config:config resolve:resolve rejecter:rejecter];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] selectProviderForJourney:journeyId provider:provider options:options config:config resolve:resolve rejecter:rejecter];
  });
}

/**
 Launches the external IdP authorization flow for an active DaVinci collector.
 */
- (void)authorizeForDaVinci:(NSString *)davinciId
                    options:(NSDictionary *)options
                     config:(NSDictionary *)config
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)rejecter
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] authorizeForDaVinci:davinciId options:options config:config resolve:resolve rejecter:rejecter];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] authorizeForDaVinci:davinciId options:options config:config resolve:resolve rejecter:rejecter];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingExternalIdpSpecJSI>(params);
}

@end
