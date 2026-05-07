/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#if __has_include(<React/RCTCallableJSModules.h>)
#import <React/RCTCallableJSModules.h>
#else
@protocol RCTCallableJSModules <NSObject>
- (void)invokeModule:(NSString *)moduleName method:(NSString *)methodName withArgs:(NSArray *)args;
@end
#endif
#if __has_include("RNPingBinding-Swift.h")
#import "RNPingBinding-Swift.h"
#else
#import <RNPingBinding/RNPingBinding-Swift.h>
#endif
#import "RNPingBindingEventEmitterGate.h"

/**
 * @interface RNPingBindingClassic
 * @brief Classic (non-Turbo) React Native module for Binding.
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingBindingClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingBindingClassic
 * @brief Implementation of the classic Binding bridge module.
 */
@implementation RNPingBindingClassic

// Receives callableJSModules from the RCT bridge (Old Arch).
@synthesize callableJSModules = _callableJSModules;

RCT_EXPORT_MODULE(RNPingBindingClassic)

- (instancetype)init
{
  self = [super init];
  if (self) {
    if (RNPingBindingClaimEventEmitterOwnership(@"classic")) {
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

#pragma mark - Binding Operations

/**
 * Executes a Journey-scoped DeviceBindingCallback.
 */
RCT_EXPORT_METHOD(bindForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
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
 * Executes a Journey-scoped DeviceSigningVerifierCallback.
 */
RCT_EXPORT_METHOD(signForJourney:(NSString *)journeyId
                  options:(NSDictionary *)options
                  config:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([NSThread isMainThread]) {
    [RNPingBindingImpl signForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    [RNPingBindingImpl signForJourney:journeyId options:options config:config resolve:resolve rejecter:reject];
  });
}

RCT_EXPORT_METHOD(resolvePin:(NSString *)requestId pin:(NSString *)pin)
{
  [RNPingBindingImpl resolvePin:requestId pin:pin];
}

RCT_EXPORT_METHOD(cancelPin:(NSString *)requestId)
{
  [RNPingBindingImpl cancelPin:requestId];
}

RCT_EXPORT_METHOD(selectUserKey:(NSString *)requestId keyId:(NSString *)keyId)
{
  [RNPingBindingImpl selectUserKey:requestId keyId:keyId];
}

RCT_EXPORT_METHOD(cancelUserKey:(NSString *)requestId)
{
  [RNPingBindingImpl cancelUserKey:requestId];
}

RCT_EXPORT_METHOD(getAllKeys:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingBindingImpl getAllKeys:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(deleteKey:(NSString *)userId
                  keyId:(NSString *)keyId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingBindingImpl deleteKey:userId keyId:keyId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(deleteAllKeys:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingBindingImpl deleteAllKeys:resolve rejecter:reject];
}

@end
