/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import "RNPingDavinci.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingDavinci-Swift.h")
#import "RNPingDavinci-Swift.h"
#else
#import <RNPingDavinci/RNPingDavinci-Swift.h>
#endif

@implementation RNPingDavinci
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation that performs all native work.
 */
- (RNPingDavinciImpl *)swiftImpl
{
  return [RNPingDavinciImpl shared];
}

/**
 Called by React Native when the bridge is torn down.
 Delegates lifecycle cleanup to the Swift common runtime.
 */
- (void)invalidate
{
  [[self swiftImpl] invalidate];
}

/// Bridges `configureDaVinci(config)` from the generated spec.
/// Maps the C++ typed config into an NSDictionary expected by Swift.
- (void)configureDaVinci:(JS::NativeRNPingDavinci::NativeDaVinciConfig &)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  dict[@"discoveryEndpoint"] = config.discoveryEndpoint();
  dict[@"clientId"] = config.clientId();
  dict[@"redirectUri"] = config.redirectUri();

  auto scopes = config.scopes();
  if (scopes.has_value()) {
    NSMutableArray<NSString *> *scopeArray = [NSMutableArray new];
    for (auto scope : scopes.value()) {
      [scopeArray addObject:scope];
    }
    dict[@"scopes"] = scopeArray;
  }

  NSString *storageId = config.storageId();
  if (storageId != nil) {
    dict[@"storageId"] = storageId;
  }
  NSString *signOutRedirectUri = config.signOutRedirectUri();
  if (signOutRedirectUri != nil) {
    dict[@"signOutRedirectUri"] = signOutRedirectUri;
  }
  NSString *loginHint = config.loginHint();
  if (loginHint != nil) {
    dict[@"loginHint"] = loginHint;
  }
  NSString *nonce = config.nonce();
  if (nonce != nil) {
    dict[@"nonce"] = nonce;
  }
  NSString *state = config.state();
  if (state != nil) {
    dict[@"state"] = state;
  }
  NSString *prompt = config.prompt();
  if (prompt != nil) {
    dict[@"prompt"] = prompt;
  }
  NSString *display = config.display();
  if (display != nil) {
    dict[@"display"] = display;
  }
  NSString *uiLocales = config.uiLocales();
  if (uiLocales != nil) {
    dict[@"uiLocales"] = uiLocales;
  }
  NSString *acrValues = config.acrValues();
  if (acrValues != nil) {
    dict[@"acrValues"] = acrValues;
  }

  auto refreshThreshold = config.refreshThreshold();
  if (refreshThreshold.has_value()) {
    dict[@"refreshThreshold"] = @(refreshThreshold.value());
  }

  id<NSObject> additionalParameters = config.additionalParameters();
  if (additionalParameters != nil) {
    dict[@"additionalParameters"] = additionalParameters;
  }

  auto timeout = config.timeout();
  if (timeout.has_value()) {
    dict[@"timeout"] = @(timeout.value());
  }

  NSString *loggerId = config.loggerId();
  if (loggerId != nil) {
    dict[@"loggerId"] = loggerId;
  }

  [[self swiftImpl] configureDaVinci:dict resolver:resolve rejecter:reject];
}

/// Bridges `start(davinciId)`.
- (void)start:(NSString *)davinciId
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] start:davinciId resolver:resolve rejecter:reject];
}

/// Bridges `next(davinciId, input)`.
- (void)next:(NSString *)davinciId
       input:(NSDictionary *)input
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] next:davinciId input:input resolver:resolve rejecter:reject];
}

/// Bridges `getSession(davinciId)`.
- (void)getSession:(NSString *)davinciId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getSession:davinciId resolver:resolve rejecter:reject];
}

/// Bridges `refresh(davinciId)`.
- (void)refresh:(NSString *)davinciId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] refresh:davinciId resolver:resolve rejecter:reject];
}

/// Bridges `revoke(davinciId)`.
/// Swift resolves a `BOOL`, converted to `NSNumber` for the JS promise.
- (void)revoke:(NSString *)davinciId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] revoke:davinciId
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

/// Bridges `userinfo(davinciId)`.
- (void)userinfo:(NSString *)davinciId
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] userinfo:davinciId resolver:resolve rejecter:reject];
}

/// Bridges `logout(davinciId)`.
/// Swift resolves void; bridge resolves `null` for JS promise compatibility.
- (void)logout:(NSString *)davinciId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] logout:davinciId
                  resolver:^{
                    resolve([NSNull null]);
                  }
                  rejecter:reject];
}

/// Bridges `dispose(davinciId)`.
/// Swift resolves void; bridge resolves `null` for JS promise compatibility.
- (void)dispose:(NSString *)davinciId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] dispose:davinciId
                   resolver:^{
                     resolve([NSNull null]);
                   }
                   rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingDavinciSpecJSI>(params);
}

@end
