/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RNPingRecaptcha.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingRecaptcha-Swift.h")
#import "RNPingRecaptcha-Swift.h"
#else
#import <RNPingRecaptcha/RNPingRecaptcha-Swift.h>
#endif

@implementation RNPingRecaptcha
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingRecaptchaImpl *)swiftImpl
{
  return [RNPingRecaptchaImpl shared];
}

/**
 Executes the active Journey ReCaptchaEnterpriseCallback resolved from a
 Journey instance id. Both verification outcomes resolve; only bridge-level
 failures reject.
 */
- (void)verifyForJourney:(NSString *)journeyId
                 options:(NSDictionary *)options
                  config:(NSDictionary *)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] verifyForJourney:journeyId
                             options:options
                              config:config
                             resolve:resolve
                            rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingRecaptchaSpecJSI>(params);
}

@end
