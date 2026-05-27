/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RNPingOath.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingOath-Swift.h"

@implementation RNPingOath
RCT_EXPORT_MODULE()

- (RNPingOathImpl *)swiftImpl
{
  return [RNPingOathImpl shared];
}

- (void)invalidate
{
  [[self swiftImpl] invalidate];
}

- (void)create:(NSDictionary *)config
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] create:config resolve:resolve rejecter:reject];
}

- (void)addCredentialFromUri:(NSString *)handle
                         uri:(NSString *)uri
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] addCredentialFromUri:handle uri:uri resolve:resolve rejecter:reject];
}

- (void)getCredential:(NSString *)handle
         credentialId:(NSString *)credentialId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getCredential:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)getCredentials:(NSString *)handle
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getCredentials:handle resolve:resolve rejecter:reject];
}

- (void)saveCredential:(NSString *)handle
            credential:(NSDictionary *)credential
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] saveCredential:handle credential:credential resolve:resolve rejecter:reject];
}

- (void)deleteCredential:(NSString *)handle
            credentialId:(NSString *)credentialId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deleteCredential:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)generateCode:(NSString *)handle
        credentialId:(NSString *)credentialId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] generateCode:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)generateCodeWithValidity:(NSString *)handle
                    credentialId:(NSString *)credentialId
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] generateCodeWithValidity:handle credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)close:(NSString *)handle
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] close:handle resolve:resolve rejecter:reject];
}

- (NSString *)registerOathPolicyEvaluator:(NSDictionary *)config
{
  return [[self swiftImpl] registerOathPolicyEvaluator:config];
}

- (id)configureOathPolicyEvaluator:(NSString *)id_
{
  return [[self swiftImpl] configureOathPolicyEvaluator:id_];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingOathSpecJSI>(params);
}

@end
