//
//  RNPingOidcClassic.mm
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

#import <React/RCTBridgeModule.h>
#if __has_include(<React/RCTCallableJSModules.h>)
#import <React/RCTCallableJSModules.h>
#else
@protocol RCTCallableJSModules <NSObject>
- (void)invokeModule:(NSString *)moduleName method:(NSString *)methodName withArgs:(NSArray *)args;
@end
#endif
#import "RNPingOidcEventEmitterGate.h"
#import "RNPingOidc-Swift.h"

/// React Native bridge module for classic (non-TurboModule) access.
@interface RNPingOidcClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingOidcClassic
@synthesize callableJSModules = _callableJSModules;

RCT_EXPORT_MODULE(RNPingOidcClassic)

- (instancetype)init
{
  self = [super init];
  if (self && RNPingOidcClaimEventEmitterOwnership(@"classic")) {
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onNativeEmit:) name:@"RNPingOidc_NativeEmit" object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  RNPingOidcReleaseEventEmitterOwnership(@"classic");
}

- (void)onNativeEmit:(NSNotification *)notification
{
  NSString *name = notification.userInfo[@"eventName"];
  id body = notification.userInfo[@"eventBody"];
  if (name && _callableJSModules) {
    [_callableJSModules invokeModule:@"RCTDeviceEventEmitter" method:@"emit" withArgs:(body ? @[name, body] : @[name])];
  }
}

// Clean up native resources when the bridge is invalidated.
- (void)invalidate
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  RNPingOidcReleaseEventEmitterOwnership(@"classic");
  [RNPingOidcCommon cleanup];
}

#pragma mark - Create Client

/// Create a native-backed OIDC client and return its core identifier.
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createClient:(NSDictionary *)config)
{
  return [RNPingOidcCommon createClient:config];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createOidcDeviceClient:(NSDictionary *)config)
{
  return [RNPingOidcCommon createOidcDeviceClient:config];
}

/// Create a native-backed OIDC web client from an existing client id.
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createWebClient:(NSString *)clientId)
{
  return [RNPingOidcCommon createWebClient:clientId];
}

RCT_EXPORT_METHOD(deviceAuthorize:(NSString *)deviceClientId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon deviceAuthorize:deviceClientId resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(cancelDeviceAuthorization:(NSString *)deviceClientId
                  subscriptionId:(NSString *)subscriptionId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon cancelDeviceAuthorization:deviceClientId subscriptionId:subscriptionId resolver:^{ resolve(nil); } rejecter:reject];
}

RCT_EXPORT_METHOD(deviceHasUser:(NSString *)deviceClientId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon deviceHasUser:deviceClientId resolver:^(BOOL value) { resolve(@(value)); } rejecter:reject];
}

RCT_EXPORT_METHOD(deviceOpenVerificationUrl:(NSString *)deviceClientId
                  verificationUri:(NSString *)verificationUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon deviceOpenVerificationUrl:deviceClientId verificationUri:verificationUri resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(deviceToken:(NSString *)deviceClientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [RNPingOidcCommon deviceToken:deviceClientId resolver:resolve rejecter:reject]; }
RCT_EXPORT_METHOD(deviceRefresh:(NSString *)deviceClientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [RNPingOidcCommon deviceRefresh:deviceClientId resolver:resolve rejecter:reject]; }
RCT_EXPORT_METHOD(deviceUserinfo:(NSString *)deviceClientId cache:(BOOL)cache resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [RNPingOidcCommon deviceUserinfo:deviceClientId cache:cache resolver:resolve rejecter:reject]; }
RCT_EXPORT_METHOD(deviceRevoke:(NSString *)deviceClientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [RNPingOidcCommon deviceRevoke:deviceClientId resolver:^{ resolve(nil); } rejecter:reject]; }
RCT_EXPORT_METHOD(deviceLogout:(NSString *)deviceClientId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) { [RNPingOidcCommon deviceLogout:deviceClientId resolver:^{ resolve(nil); } rejecter:reject]; }
RCT_EXPORT_METHOD(disposeOidcDeviceClient:(NSString *)deviceClientId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon disposeOidcDeviceClient:deviceClientId resolver:^{ resolve(nil); } rejecter:reject];
}

#pragma mark - Client Tokens

/// Resolve the current client's tokens.
RCT_EXPORT_METHOD(clientToken:(NSString *)clientId
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon clientToken:clientId resolver:resolve rejecter:reject];
}

/// Force-refresh the current client's tokens.
RCT_EXPORT_METHOD(clientRefresh:(NSString *)clientId
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon clientRefresh:clientId resolver:resolve rejecter:reject];
}

/// Fetch user profile data from the userinfo endpoint for the client.
RCT_EXPORT_METHOD(clientUserinfo:(NSString *)clientId
                 cache:(BOOL)cache
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon clientUserinfo:clientId cache:cache resolver:resolve rejecter:reject];
}

/// Revoke tokens for the current client.
RCT_EXPORT_METHOD(clientRevoke:(NSString *)clientId
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon clientRevoke:clientId
                 resolver:^{
                   resolve([NSNull null]);
                 }
                 rejecter:reject];
}

/// End the current client session.
RCT_EXPORT_METHOD(clientEndSession:(NSString *)clientId
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon clientEndSession:clientId
                 resolver:^(BOOL value) {
                   resolve(@(value));
                 }
                 rejecter:reject];
}

#pragma mark - Authorize

/// Launch the authorization flow.
RCT_EXPORT_METHOD(authorize:(NSString *)webClientId
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon authorize:webClientId options:options resolver:resolve rejecter:reject];
}

#pragma mark - User State

/// Resolve whether a user is available for the given web client.
RCT_EXPORT_METHOD(hasUser:(NSString *)webClientId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon hasUser:webClientId
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

/// Resolve the current user's tokens.
RCT_EXPORT_METHOD(token:(NSString *)webClientId
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon token:webClientId resolver:resolve rejecter:reject];
}

/// Refresh tokens for the current user.
RCT_EXPORT_METHOD(refresh:(NSString *)webClientId
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon refresh:webClientId resolver:resolve rejecter:reject];
}

/// Fetch user profile data from the userinfo endpoint.
RCT_EXPORT_METHOD(userinfo:(NSString *)webClientId
                 cache:(BOOL)cache
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon userinfo:webClientId cache:cache resolver:resolve rejecter:reject];
}

/// Revoke tokens for the current user.
RCT_EXPORT_METHOD(revoke:(NSString *)webClientId
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon revoke:webClientId
                 resolver:^{
                   resolve([NSNull null]);
                 }
                 rejecter:reject];
}

/// Logout the current user.
RCT_EXPORT_METHOD(logout:(NSString *)webClientId
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon logout:webClientId
                 resolver:^{
                   resolve([NSNull null]);
                 }
                 rejecter:reject];
}

@end
