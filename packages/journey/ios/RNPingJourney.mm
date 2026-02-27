/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingJourney.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

// Auto-generated Swift header for the module's Swift implementation.
#import "RNPingJourney-Swift.h"

@implementation RNPingJourney
RCT_EXPORT_MODULE()

// Returns the shared Swift implementation that performs all native work.
- (RNPingJourneyImpl *)swiftImpl {
  return [RNPingJourneyImpl shared];
}

// Called by React Native when the bridge is torn down.
// Delegates lifecycle cleanup to Swift common runtime.
- (void)invalidate
{
  [[self swiftImpl] invalidate];
}

// Bridges `configureJourney(config)` from the generated spec.
// Maps the C++ typed config into an NSDictionary expected by Swift.
- (void)configureJourney:(JS::NativeRNPingJourney::NativeJourneyConfig &)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  NSMutableDictionary *dict = [NSMutableDictionary new];

  dict[@"serverUrl"] = config.serverUrl();
  auto timeout = config.timeout();
  if (timeout.has_value()) {
    dict[@"timeout"] = @(timeout.value());
  }

  NSString *realm = config.realm();
  if (realm != nil) {
    dict[@"realm"] = realm;
  }
  NSString *cookie = config.cookie();
  if (cookie != nil) {
    dict[@"cookie"] = cookie;
  }
  NSString *clientId = config.clientId();
  if (clientId != nil) {
    dict[@"clientId"] = clientId;
  }
  NSString *discoveryEndpoint = config.discoveryEndpoint();
  if (discoveryEndpoint != nil) {
    dict[@"discoveryEndpoint"] = discoveryEndpoint;
  }
  NSString *redirectUri = config.redirectUri();
  if (redirectUri != nil) {
    dict[@"redirectUri"] = redirectUri;
  }

  auto scopes = config.scopes();
  if (scopes.has_value()) {
    NSMutableArray<NSString *> *scopeArray = [NSMutableArray new];
    for (auto scope : scopes.value()) {
      [scopeArray addObject:scope];
    }
    dict[@"scopes"] = scopeArray;
  }

  auto openId = config.openId();
  if (openId.has_value()) {
    auto openIdValue = openId.value();
    NSMutableDictionary *openIdDict = [NSMutableDictionary new];
    openIdDict[@"authorizationEndpoint"] = openIdValue.authorizationEndpoint();
    openIdDict[@"tokenEndpoint"] = openIdValue.tokenEndpoint();
    openIdDict[@"userinfoEndpoint"] = openIdValue.userinfoEndpoint();
    NSString *endSessionEndpoint = openIdValue.endSessionEndpoint();
    if (endSessionEndpoint != nil) {
      openIdDict[@"endSessionEndpoint"] = endSessionEndpoint;
    }
    NSString *pingEndIdpSessionEndpoint = openIdValue.pingEndIdpSessionEndpoint();
    if (pingEndIdpSessionEndpoint != nil) {
      openIdDict[@"pingEndIdpSessionEndpoint"] = pingEndIdpSessionEndpoint;
    }
    NSString *revocationEndpoint = openIdValue.revocationEndpoint();
    if (revocationEndpoint != nil) {
      openIdDict[@"revocationEndpoint"] = revocationEndpoint;
    }
    dict[@"openId"] = openIdDict;
  }

  NSString *acrValues = config.acrValues();
  if (acrValues != nil) {
    dict[@"acrValues"] = acrValues;
  }
  NSString *signOutRedirectUri = config.signOutRedirectUri();
  if (signOutRedirectUri != nil) {
    dict[@"signOutRedirectUri"] = signOutRedirectUri;
  }
  NSString *state = config.state();
  if (state != nil) {
    dict[@"state"] = state;
  }
  NSString *nonce = config.nonce();
  if (nonce != nil) {
    dict[@"nonce"] = nonce;
  }
  NSString *uiLocales = config.uiLocales();
  if (uiLocales != nil) {
    dict[@"uiLocales"] = uiLocales;
  }
  auto refreshThreshold = config.refreshThreshold();
  if (refreshThreshold.has_value()) {
    dict[@"refreshThreshold"] = @(refreshThreshold.value());
  }
  NSString *loginHint = config.loginHint();
  if (loginHint != nil) {
    dict[@"loginHint"] = loginHint;
  }
  NSString *display = config.display();
  if (display != nil) {
    dict[@"display"] = display;
  }
  NSString *prompt = config.prompt();
  if (prompt != nil) {
    dict[@"prompt"] = prompt;
  }

  id<NSObject> additionalParameters = config.additionalParameters();
  if (additionalParameters != nil) {
    dict[@"additionalParameters"] = additionalParameters;
  }
  NSString *sessionStorageId = config.sessionStorageId();
  if (sessionStorageId != nil) {
    dict[@"sessionStorageId"] = sessionStorageId;
  }
  NSString *oidcStorageId = config.oidcStorageId();
  if (oidcStorageId != nil) {
    dict[@"oidcStorageId"] = oidcStorageId;
  }
  NSString *loggerId = config.loggerId();
  if (loggerId != nil) {
    dict[@"loggerId"] = loggerId;
  }
  NSString *oidcClientId = config.oidcClientId();
  if (oidcClientId != nil) {
    dict[@"oidcClientId"] = oidcClientId;
  }

  [[self swiftImpl] configureJourney:dict resolver:resolve rejecter:reject];
}

// Bridges `start(journeyId, journeyName, options)`.
// Converts optional start flags into a dictionary payload for Swift.
- (void)start:(NSString *)journeyId
    journeyName:(NSString *)journeyName
        options:(JS::NativeRNPingJourney::JourneyOptions &)options
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  NSMutableDictionary *opts = [NSMutableDictionary new];
  if (options.forceAuth().has_value()) {
    opts[@"forceAuth"] = @(options.forceAuth().value());
  }
  if (options.noSession().has_value()) {
    opts[@"noSession"] = @(options.noSession().value());
  }

  [[self swiftImpl] start:journeyId
              journeyName:journeyName
                  options:opts
                 resolver:resolve
                 rejecter:reject];
}

// Bridges `next(journeyId, nodeId, input)`.
// Normalizes callback mutation payload into NSDictionary/NSArray for Swift.
- (void)next:(NSString *)journeyId
      nodeId:(NSString *)nodeId
       input:(JS::NativeRNPingJourney::NativeJourneyNextInput &)input
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject {
  NSMutableDictionary *inputDict = [NSMutableDictionary new];
  auto callbacks = input.callbacks();
  if (callbacks.has_value()) {
    NSMutableArray<NSDictionary *> *callbackArray = [NSMutableArray new];
    for (auto callback : callbacks.value()) {
      NSMutableDictionary *callbackDict = [NSMutableDictionary new];
      callbackDict[@"type"] = callback.type();
      id<NSObject> value = callback.value();
      if (value != nil) {
        callbackDict[@"value"] = value;
      }
      auto index = callback.index();
      if (index.has_value()) {
        callbackDict[@"index"] = @(index.value());
      }
      [callbackArray addObject:callbackDict];
    }
    inputDict[@"callbacks"] = callbackArray;
  }

  [[self swiftImpl] next:journeyId
                  nodeId:nodeId
                   input:inputDict
                resolver:resolve
                rejecter:reject];
}

// Bridges `resume(journeyId, uri)`.
- (void)resume:(NSString *)journeyId
           uri:(NSString *)uri
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] resume:journeyId uri:uri resolver:resolve rejecter:reject];
}

// Bridges `getSession(journeyId)`.
- (void)getSession:(NSString *)journeyId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] getSession:journeyId resolver:resolve rejecter:reject];
}

// Bridges `refresh(journeyId)`.
- (void)refresh:(NSString *)journeyId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] refresh:journeyId resolver:resolve rejecter:reject];
}

// Bridges `revoke(journeyId)`.
// Swift resolves a BOOL which is converted to NSNumber for JS promises.
- (void)revoke:(NSString *)journeyId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] revoke:journeyId
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

// Bridges `userinfo(journeyId)`.
- (void)userinfo:(NSString *)journeyId
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] userinfo:journeyId resolver:resolve rejecter:reject];
}

// Bridges `ssoToken(journeyId)`.
- (void)ssoToken:(NSString *)journeyId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] ssoToken:journeyId resolver:resolve rejecter:reject];
}

// Bridges `logout(journeyId)`.
// Swift resolves a BOOL which is converted to NSNumber for JS promises.
- (void)logout:(NSString *)journeyId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] logout:journeyId
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

// Bridges `dispose(journeyId)`.
// Swift resolves void; bridge resolves `null` for JS promise compatibility.
- (void)dispose:(NSString *)journeyId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  [[self swiftImpl] dispose:journeyId
                   resolver:^{
                     resolve([NSNull null]);
                   }
                   rejecter:reject];
}

// Returns the TurboModule JSI binding generated from NativeRNPingJourneySpec.
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingJourneySpecJSI>(params);
}

@end
