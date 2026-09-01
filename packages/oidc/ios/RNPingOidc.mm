//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
#import "RNPingOidc.h"
#import "RCTDefaultReactNativeFactoryDelegate.h"

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
#import "RNPingOidcEventEmitterGate.h"

#import "RNPingOidc-Swift.h"

@implementation RNPingOidc
@synthesize callableJSModules = _callableJSModules;
RCT_EXPORT_MODULE()

- (instancetype)init
{
  self = [super init];
  if (self && RNPingOidcClaimEventEmitterOwnership(@"turbo")) {
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onNativeEmit:) name:@"RNPingOidc_NativeEmit" object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  RNPingOidcReleaseEventEmitterOwnership(@"turbo");
}

- (void)onNativeEmit:(NSNotification *)notification
{
  NSString *name = notification.userInfo[@"eventName"];
  id body = notification.userInfo[@"eventBody"];
  if (name && _callableJSModules) {
    [_callableJSModules invokeModule:@"RCTDeviceEventEmitter" method:@"emit" withArgs:(body ? @[name, body] : @[name])];
  }
}

// Helper to get the Swift singleton.
- (RNPingOidcImpl *)swiftImpl
{
  return [RNPingOidcImpl shared];
}

// Clean up native resources when the bridge is invalidated.
- (void)invalidate
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  RNPingOidcReleaseEventEmitterOwnership(@"turbo");
  [[self swiftImpl] invalidate];
}

// createClient(config): string
- (NSString *)createClient:(JS::NativeRNPingOidc::NativeOidcClientConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *clientId = config.clientId();
  if (clientId != nil) {
    dict[@"clientId"] = clientId;
  }

  NSString *discoveryEndpoint = config.discoveryEndpoint();
  if (discoveryEndpoint != nil) {
    dict[@"discoveryEndpoint"] = discoveryEndpoint;
  }

  auto openId = config.openId();
  if (openId.has_value()) {
    auto openIdValue = openId.value();
    NSMutableDictionary *openIdDict = [NSMutableDictionary new];
    NSString *authorizationEndpoint = openIdValue.authorizationEndpoint();
    if (authorizationEndpoint != nil) {
      openIdDict[@"authorizationEndpoint"] = authorizationEndpoint;
    }
    NSString *tokenEndpoint = openIdValue.tokenEndpoint();
    if (tokenEndpoint != nil) {
      openIdDict[@"tokenEndpoint"] = tokenEndpoint;
    }
    NSString *userinfoEndpoint = openIdValue.userinfoEndpoint();
    if (userinfoEndpoint != nil) {
      openIdDict[@"userinfoEndpoint"] = userinfoEndpoint;
    }
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
    NSString *deviceAuthorizationEndpoint = openIdValue.deviceAuthorizationEndpoint();
    if (deviceAuthorizationEndpoint != nil) {
      openIdDict[@"deviceAuthorizationEndpoint"] = deviceAuthorizationEndpoint;
    }
    dict[@"openId"] = openIdDict;
  }

  NSString *redirectUri = config.redirectUri();
  if (redirectUri != nil) {
    dict[@"redirectUri"] = redirectUri;
  }

  NSMutableArray<NSString *> *scopes = [NSMutableArray new];
  for (auto scope : config.scopes()) {
    [scopes addObject:scope];
  }
  dict[@"scopes"] = scopes;

  NSString *storageId = config.storageId();
  if (storageId != nil) {
    dict[@"storageId"] = storageId;
  }

  NSString *loggerId = config.loggerId();
  if (loggerId != nil) {
    dict[@"loggerId"] = loggerId;
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

  return [[self swiftImpl] createClient:dict];
}

- (NSString *)createOidcDeviceClient:(JS::NativeRNPingOidc::NativeOidcClientConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];
  dict[@"clientId"] = config.clientId();
  if (config.discoveryEndpoint()) dict[@"discoveryEndpoint"] = config.discoveryEndpoint();
  dict[@"redirectUri"] = config.redirectUri();
  NSMutableArray *scopes = [NSMutableArray new];
  for (auto scope : config.scopes()) [scopes addObject:scope];
  dict[@"scopes"] = scopes;
  if (config.storageId()) dict[@"storageId"] = config.storageId();
  if (config.loggerId()) dict[@"loggerId"] = config.loggerId();
  auto openId = config.openId();
  if (openId.has_value()) {
    auto value = openId.value();
    NSMutableDictionary *openIdDict = [NSMutableDictionary new];
    if (value.authorizationEndpoint()) openIdDict[@"authorizationEndpoint"] = value.authorizationEndpoint();
    if (value.tokenEndpoint()) openIdDict[@"tokenEndpoint"] = value.tokenEndpoint();
    if (value.userinfoEndpoint()) openIdDict[@"userinfoEndpoint"] = value.userinfoEndpoint();
    if (value.endSessionEndpoint()) openIdDict[@"endSessionEndpoint"] = value.endSessionEndpoint();
    if (value.pingEndIdpSessionEndpoint()) openIdDict[@"pingEndIdpSessionEndpoint"] = value.pingEndIdpSessionEndpoint();
    if (value.revocationEndpoint()) openIdDict[@"revocationEndpoint"] = value.revocationEndpoint();
    if (value.deviceAuthorizationEndpoint()) openIdDict[@"deviceAuthorizationEndpoint"] = value.deviceAuthorizationEndpoint();
    dict[@"openId"] = openIdDict;
  }
  return [[self swiftImpl] createOidcDeviceClient:dict];
}

- (void)deviceAuthorize:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deviceAuthorize:deviceClientId resolver:resolve rejecter:reject];
}

- (void)cancelDeviceAuthorization:(NSString *)deviceClientId subscriptionId:(NSString *)subscriptionId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] cancelDeviceAuthorization:deviceClientId subscriptionId:subscriptionId resolver:^{ resolve([NSNull null]); } rejecter:reject];
}

- (void)deviceOpenVerificationUrl:(NSString *)deviceClientId verificationUri:(NSString *)verificationUri resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deviceOpenVerificationUrl:deviceClientId verificationUri:verificationUri resolver:resolve rejecter:reject];
}

- (void)deviceHasUser:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deviceHasUser:deviceClientId resolver:^(BOOL value) { resolve(@(value)); } rejecter:reject];
}

- (void)deviceToken:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject { [[self swiftImpl] deviceToken:deviceClientId resolver:resolve rejecter:reject]; }
- (void)deviceRefresh:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject { [[self swiftImpl] deviceRefresh:deviceClientId resolver:resolve rejecter:reject]; }
- (void)deviceUserinfo:(NSString *)deviceClientId cache:(BOOL)cache resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject { [[self swiftImpl] deviceUserinfo:deviceClientId cache:cache resolver:resolve rejecter:reject]; }
- (void)deviceRevoke:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject { [[self swiftImpl] deviceRevoke:deviceClientId resolver:^{ resolve([NSNull null]); } rejecter:reject]; }
- (void)deviceLogout:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject { [[self swiftImpl] deviceLogout:deviceClientId resolver:^{ resolve([NSNull null]); } rejecter:reject]; }
- (void)disposeOidcDeviceClient:(NSString *)deviceClientId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] disposeOidcDeviceClient:deviceClientId resolver:^{ resolve([NSNull null]); } rejecter:reject];
}

// createWebClient(clientId): string
- (NSString *)createWebClient:(NSString *)clientId
{
  return [[self swiftImpl] createWebClient:clientId];
}

// clientToken(clientId): Promise<Tokens>
- (void)clientToken:(NSString *)clientId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientToken:clientId resolver:resolve rejecter:reject];
}

// clientRefresh(clientId): Promise<Tokens>
- (void)clientRefresh:(NSString *)clientId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientRefresh:clientId resolver:resolve rejecter:reject];
}

// clientUserinfo(clientId, cache): Promise<Record<string, unknown>>
- (void)clientUserinfo:(NSString *)clientId
                 cache:(BOOL)cache
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientUserinfo:clientId cache:cache resolver:resolve rejecter:reject];
}

// clientRevoke(clientId): Promise<void>
- (void)clientRevoke:(NSString *)clientId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientRevoke:clientId
                        resolver:^{
                          resolve([NSNull null]);
                        }
                        rejecter:reject];
}

// clientEndSession(clientId): Promise<boolean>
- (void)clientEndSession:(NSString *)clientId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientEndSession:clientId
                        resolver:^(BOOL value) {
                          resolve(@(value));
                        }
                        rejecter:reject];
}

// authorize(webClientId, options): Promise<OidcAuthorizeResult>
- (void)authorize:(NSString *)webClientId
          options:(JS::NativeRNPingOidc::NativeOidcAuthorizeOptions &)options
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  NSMutableDictionary *dict = [NSMutableDictionary new];
  NSString *acrValues = options.acrValues();
  if (acrValues != nil) {
    dict[@"acrValues"] = acrValues;
  }
  NSString *state = options.state();
  if (state != nil) {
    dict[@"state"] = state;
  }
  NSString *nonce = options.nonce();
  if (nonce != nil) {
    dict[@"nonce"] = nonce;
  }
  NSString *uiLocales = options.uiLocales();
  if (uiLocales != nil) {
    dict[@"uiLocales"] = uiLocales;
  }
  NSString *loginHint = options.loginHint();
  if (loginHint != nil) {
    dict[@"loginHint"] = loginHint;
  }
  NSString *display = options.display();
  if (display != nil) {
    dict[@"display"] = display;
  }
  NSString *prompt = options.prompt();
  if (prompt != nil) {
    dict[@"prompt"] = prompt;
  }
  id<NSObject> additionalParameters = options.additionalParameters();
  if (additionalParameters != nil) {
    dict[@"additionalParameters"] = additionalParameters;
  }
  [[self swiftImpl] authorize:webClientId options:dict resolver:resolve rejecter:reject];
}

// hasUser(webClientId): Promise<boolean>
- (void)hasUser:(NSString *)webClientId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] hasUser:webClientId
                   resolver:^(BOOL value) {
                     resolve(@(value));
                   }
                   rejecter:reject];
}

// token(webClientId): Promise<Tokens>
- (void)token:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] token:webClientId resolver:resolve rejecter:reject];
}

// refresh(webClientId): Promise<Tokens>
- (void)refresh:(NSString *)webClientId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] refresh:webClientId resolver:resolve rejecter:reject];
}

// userinfo(webClientId, cache): Promise<Record<string, unknown>>
- (void)userinfo:(NSString *)webClientId
           cache:(BOOL)cache
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] userinfo:webClientId
                       cache:cache
                    resolver:resolve
                    rejecter:reject];
}

// revoke(webClientId): Promise<void>
- (void)revoke:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] revoke:webClientId
                  resolver:^{
                    resolve([NSNull null]);
                  }
                  rejecter:reject];
}

// logout(webClientId): Promise<void>
- (void)logout:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] logout:webClientId
                  resolver:^{
                    resolve([NSNull null]);
                  }
                  rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingOidcSpecJSI>(params);
}

@end
