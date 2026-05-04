/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
// TODO(cleanup): Remove this scaffold import in a cross-module iOS bridge cleanup pass.
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingBinding.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#if __has_include(<React/RCTCallableJSModules.h>)
#import <React/RCTCallableJSModules.h>
#else
@protocol RCTCallableJSModules <NSObject>
- (void)invokeModule:(NSString *)moduleName method:(NSString *)methodName withArgs:(NSArray *)args;
@end
#endif
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingBinding-Swift.h"
#import "RNPingBindingEventEmitterGate.h"

@implementation RNPingBinding

// Receives callableJSModules from the RCT module registry (Old + New Arch).
@synthesize callableJSModules = _callableJSModules;

RCT_EXPORT_MODULE()

- (instancetype)init
{
  self = [super init];
  if (self) {
    if (RNPingBindingClaimEventEmitterOwnership(@"turbo")) {
      [[NSNotificationCenter defaultCenter]
          addObserver:self
             selector:@selector(onNativeEmit:)
                 name:@"RNPingBinding_NativeEmit"
               object:nil];
    }
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

/**
 * Receives internal emit notifications from Swift bridge collectors and
 * forwards them to JS DeviceEventEmitter via callableJSModules.
 */
- (void)onNativeEmit:(NSNotification *)notification
{
  NSString *name = notification.userInfo[@"eventName"];
  id body = notification.userInfo[@"eventBody"];
  if (!name || !_callableJSModules) {
    return;
  }
  NSArray *args = body ? @[name, body] : @[name];
  [_callableJSModules invokeModule:@"RCTDeviceEventEmitter" method:@"emit" withArgs:args];
}

/**
 Executes a Journey-scoped DeviceBindingCallback.
 */
- (void)bindForJourney:(NSString *)journeyId
               options:(NSDictionary *)options
                config:(NSDictionary *)config
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [RNPingBindingImpl bindForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [RNPingBindingImpl bindForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  });
}

/**
 Executes a Journey-scoped DeviceSigningVerifierCallback.
 */
- (void)signForJourney:(NSString *)journeyId
               options:(NSDictionary *)options
                config:(NSDictionary *)config
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [RNPingBindingImpl signForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [RNPingBindingImpl signForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  });
}

- (void)resolvePin:(NSString *)requestId pin:(NSString *)pin
{
  [RNPingBindingImpl resolvePin:requestId pin:pin];
}

- (void)cancelPin:(NSString *)requestId
{
  [RNPingBindingImpl cancelPin:requestId];
}

- (void)selectUserKey:(NSString *)requestId keyId:(NSString *)keyId
{
  [RNPingBindingImpl selectUserKey:requestId keyId:keyId];
}

- (void)cancelUserKey:(NSString *)requestId
{
  [RNPingBindingImpl cancelUserKey:requestId];
}

- (void)getAllKeys:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [RNPingBindingImpl getAllKeys:resolve rejecter:reject];
}

- (void)deleteKey:(NSString *)userId
            keyId:(NSString *)keyId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [RNPingBindingImpl deleteKey:userId keyId:keyId resolve:resolve rejecter:reject];
}

- (void)deleteAllKeys:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [RNPingBindingImpl deleteAllKeys:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingBindingSpecJSI>(params);
}

@end
