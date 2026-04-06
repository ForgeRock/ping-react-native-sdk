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

#pragma mark - FIDO Operations

/**
 * Registers a new FIDO credential.
 */
RCT_EXPORT_METHOD(registerCredential:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [[RNPingFidoImpl shared] register:options resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[RNPingFidoImpl shared] register:options resolve:resolve rejecter:reject];
  });
}

/**
 * Authenticates with an existing FIDO credential.
 */
RCT_EXPORT_METHOD(authenticateCredential:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [[RNPingFidoImpl shared] authenticate:options resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[RNPingFidoImpl shared] authenticate:options resolve:resolve rejecter:reject];
  });
}

/**
 * Executes a Journey-scoped FIDO registration callback.
 */
RCT_EXPORT_METHOD(registerCredentialForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [[RNPingFidoImpl shared] registerForJourney:journeyId options:options resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[RNPingFidoImpl shared] registerForJourney:journeyId options:options resolve:resolve rejecter:reject];
  });
}

/**
 * Executes a Journey-scoped FIDO authentication callback.
 */
RCT_EXPORT_METHOD(authenticateCredentialForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [[RNPingFidoImpl shared] authenticateForJourney:journeyId options:options resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[RNPingFidoImpl shared] authenticateForJourney:journeyId options:options resolve:resolve rejecter:reject];
  });
}

@end
