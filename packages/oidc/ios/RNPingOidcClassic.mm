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
#import "RNPingOidc-Swift.h"

/// React Native bridge module for classic (non-TurboModule) access.
@interface RNPingOidcClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingOidcClassic

RCT_EXPORT_MODULE(RNPingOidcClassic)

#pragma mark - Create Client

/// Create a native-backed OIDC client and return its core identifier.
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createClient:(NSDictionary *)config)
{
  return [RNPingOidcCommon createClient:config];
}

/// Create a native-backed OIDC web client from an existing client id.
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createWebClient:(NSString *)clientId)
{
  return [RNPingOidcCommon createWebClient:clientId];
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
                 resolver:^(BOOL value) {
                   resolve(@(value));
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
                 resolver:^(BOOL value) {
                   resolve(@(value));
                 }
                 rejecter:reject];
}

/// Logout the current user.
RCT_EXPORT_METHOD(logout:(NSString *)webClientId
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingOidcCommon logout:webClientId
                 resolver:^(BOOL value) {
                   resolve(@(value));
                 }
                 rejecter:reject];
}

@end
