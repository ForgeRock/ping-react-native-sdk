/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <string>
// TODO(cleanup): Remove this scaffold import in a cross-module iOS bridge cleanup pass.
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingFido.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingFido-Swift.h"

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

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingFidoSpecJSI>(params);
}

@end
