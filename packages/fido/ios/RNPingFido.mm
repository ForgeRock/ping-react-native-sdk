/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <string>
#import "RNPingFido.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingFido-Swift.h")
#import "RNPingFido-Swift.h"
#else
#import <RNPingFido/RNPingFido-Swift.h>
#endif

@implementation RNPingFido
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingFidoImpl *)swiftImpl
{
  return [RNPingFidoImpl shared];
}

/**
 Registers the DaVinci FIDO2 collector serializer with CoreRuntime.

 Called from the JS FIDO client factory at client creation. Synchronous and
 thread-safe by design: registration is an idempotent in-memory registry
 append, so no main-thread dispatch is used — a dispatch would return before
 registration completes and reintroduce the timing race this method closes.
 */
- (void)registerDaVinciSerializer
{
  [RNPingFidoCommon registerDaVinciSerializer];
}

/**
 Registers a new FIDO credential.
 */
- (void)registerCredential:(NSDictionary *)options
                    config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] register:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] register:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Authenticates with an existing FIDO credential.
 */
- (void)authenticateCredential:(NSDictionary *)options
                        config:(NSDictionary *)config
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] authenticate:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] authenticate:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Executes a Journey-scoped FIDO registration callback.
 */
- (void)registerCredentialForJourney:(NSString *)journeyId
                             options:(NSDictionary *)options
                              config:(NSDictionary *)config
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] registerForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] registerForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Executes a Journey-scoped FIDO authentication callback.
 */
- (void)authenticateCredentialForJourney:(NSString *)journeyId
                                options:(NSDictionary *)options
                                 config:(NSDictionary *)config
                                resolve:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] authenticateForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] authenticateForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Runs the native FIDO registration ceremony for an active DaVinci FIDO2 registration collector.
 */
- (void)registerCredentialForDaVinci:(NSString *)davinciId
                              options:(NSDictionary *)options
                               config:(NSDictionary *)config
                              resolve:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] registerForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] registerForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Runs the native FIDO authentication ceremony for an active DaVinci FIDO2 authentication collector.
 */
- (void)authenticateCredentialForDaVinci:(NSString *)davinciId
                                  options:(NSDictionary *)options
                                   config:(NSDictionary *)config
                                  resolve:(RCTPromiseResolveBlock)resolve
                                   reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] authenticateForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] authenticateForDaVinci:davinciId options:options config:config resolve:resolve rejecter:reject];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingFidoSpecJSI>(params);
}

@end
