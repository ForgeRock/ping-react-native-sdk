/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include("RNPingFido-Swift.h")
#import "RNPingFido-Swift.h"
#else
#import <RNPingFido/RNPingFido-Swift.h>
#endif

/**
 * @interface RNPingFidoClassic
 * @brief Classic (non-Turbo) React Native module for FIDO.
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingFidoClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingFidoClassic
 * @brief Implementation of the classic FIDO bridge module.
 */
@implementation RNPingFidoClassic

RCT_EXPORT_MODULE(RNPingFidoClassic)

#pragma mark - Default FIDO

/**
 * Returns the default FIDO identifier.
 */
RCT_EXPORT_METHOD(getDefaultFido:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [[RNPingFidoImpl shared] getDefaultFido:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[RNPingFidoImpl shared] getDefaultFido:resolve rejecter:reject];
  });
}

@end
