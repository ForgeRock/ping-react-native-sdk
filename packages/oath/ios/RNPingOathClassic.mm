/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <React/RCTBridgeModule.h>
#if __has_include("RNPingOath-Swift.h")
#import "RNPingOath-Swift.h"
#else
#import <RNPingOath/RNPingOath-Swift.h>
#endif

/**
 * @interface RNPingOathClassic
 * @brief Classic (non-Turbo) React Native module for OATH.
 *
 * This module is used when the New Architecture is disabled.
 */
@interface RNPingOathClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingOathClassic

RCT_EXPORT_MODULE(RNPingOathClassic)

- (void)invalidate
{
  [[RNPingOathImpl shared] invalidate];
}

RCT_EXPORT_METHOD(create:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] create:config resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(addCredentialFromUri:(NSString *)handle
                  uri:(NSString *)uri
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] addCredentialFromUri:handle uri:uri resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getCredential:(NSString *)handle
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] getCredential:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getCredentials:(NSString *)handle
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] getCredentials:handle resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(saveCredential:(NSString *)handle
                  credential:(NSDictionary *)credential
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] saveCredential:handle credential:credential resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(deleteCredential:(NSString *)handle
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] deleteCredential:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(generateCode:(NSString *)handle
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] generateCode:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(generateCodeWithValidity:(NSString *)handle
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] generateCodeWithValidity:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(close:(NSString *)handle
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingOathImpl shared] close:handle resolve:resolve rejecter:reject];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(registerOathPolicyEvaluator:(NSDictionary *)config)
{
  return [[RNPingOathImpl shared] registerOathPolicyEvaluator:config];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configureOathPolicyEvaluator:(NSString *)id_)
{
  return [[RNPingOathImpl shared] configureOathPolicyEvaluator:id_];
}

@end
