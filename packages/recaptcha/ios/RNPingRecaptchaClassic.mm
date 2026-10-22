/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingRecaptcha-Swift.h")
#import "RNPingRecaptcha-Swift.h"
#else
#import <RNPingRecaptcha/RNPingRecaptcha-Swift.h>
#endif

/**
 * @interface RNPingRecaptchaClassic
 * @brief Classic (non-Turbo) React Native module for reCAPTCHA Enterprise.
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingRecaptchaClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingRecaptchaClassic
 * @brief Implementation of the classic reCAPTCHA bridge module.
 */
@implementation RNPingRecaptchaClassic

RCT_EXPORT_MODULE(RNPingRecaptchaClassic)

/**
 * Executes a block with the shared Swift implementation on the calling thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 *
 * - Note: No main-thread dispatch is used — the Swift implementation is
 *   thread-safe and reCAPTCHA verification presents no UI.
 */
- (void)withSwiftImpl:(void (^)(RNPingRecaptchaImpl *impl))block
{
  block([RNPingRecaptchaImpl shared]);
}

#pragma mark - reCAPTCHA Operations

/**
 * Executes the active Journey ReCaptchaEnterpriseCallback.
 */
RCT_EXPORT_METHOD(verifyForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingRecaptchaImpl *impl) {
    [impl verifyForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  }];
}

@end
