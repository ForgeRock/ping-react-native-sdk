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

/**
 * Executes a block with the shared Swift implementation on the main thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 */
- (void)withSwiftImpl:(void (^)(RNPingFidoImpl *impl))block
{
  if ([NSThread isMainThread]) {
    block([RNPingFidoImpl shared]);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    block([RNPingFidoImpl shared]);
  });
}

#pragma mark - DaVinci Serializer Registration

/**
 * Registers the DaVinci FIDO2 collector serializer with CoreRuntime.
 *
 * Called from the JS FIDO client factory at client creation. Synchronous and
 * thread-safe by design: registration is an idempotent in-memory registry
 * append, so no main-thread dispatch is used — a dispatch would return before
 * registration completes and reintroduce the timing race this method closes.
 */
RCT_EXPORT_METHOD(registerDaVinciSerializer)
{
  [RNPingFidoCommon registerDaVinciSerializer];
}

#pragma mark - FIDO Operations

/**
 * Registers a new FIDO credential.
 */
RCT_EXPORT_METHOD(registerCredential:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl register:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Authenticates with an existing FIDO credential.
 */
RCT_EXPORT_METHOD(authenticateCredential:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl authenticate:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Executes a Journey-scoped FIDO registration callback.
 */
RCT_EXPORT_METHOD(registerCredentialForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl registerForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Executes a Journey-scoped FIDO authentication callback.
 */
RCT_EXPORT_METHOD(authenticateCredentialForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl authenticateForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Runs the native FIDO registration ceremony for an active DaVinci FIDO2 registration collector.
 */
RCT_EXPORT_METHOD(registerCredentialForDaVinci:(NSString *)davinciId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl registerForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  }];
}

/**
 * Runs the native FIDO authentication ceremony for an active DaVinci FIDO2 authentication collector.
 */
RCT_EXPORT_METHOD(authenticateCredentialForDaVinci:(NSString *)davinciId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingFidoImpl *impl) {
    [impl authenticateForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  }];
}

@end
