/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RNPingPush.h"

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>
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
#import "RNPingPush-Swift.h"

@implementation RNPingPush {
  NSString *_pendingAPNsToken;
}

@synthesize callableJSModules = _callableJSModules;

RCT_EXPORT_MODULE()

- (RNPingPushImpl *)swiftImpl
{
  return [RNPingPushImpl shared];
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(onAPNsToken:)
               name:@"com.pingidentity.rnpush.APNsToken"
             object:nil];
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(onRemoteNotification:)
               name:@"com.pingidentity.rnpush.RemoteNotification"
             object:nil];
  }
  return self;
}

- (void)onRemoteNotification:(NSNotification *)notification
{
  NSDictionary *userInfo = notification.userInfo;
  if (!userInfo) { return; }
  if (!_callableJSModules) {
    [RNPingPushCommon enqueuePendingMessage:userInfo];
    return;
  }
  [_callableJSModules invokeModule:@"RCTDeviceEventEmitter"
                            method:@"emit"
                          withArgs:@[RNPingPushEvents.pushMessageReceived, userInfo]];
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)setCallableJSModules:(RCTCallableJSModules *)callableJSModules
{
  _callableJSModules = callableJSModules;
  // Drain instance-level pending token (arrived after init but before JS was ready).
  if (!_pendingAPNsToken) {
    // Drain static-level pending token (arrived before the module was even instantiated).
    _pendingAPNsToken = [RNPingPushCommon consumePendingToken];
  }
  if (_pendingAPNsToken && _callableJSModules) {
    NSString *token = _pendingAPNsToken;
    _pendingAPNsToken = nil;
    [_callableJSModules invokeModule:@"RCTDeviceEventEmitter"
                              method:@"emit"
                            withArgs:@[RNPingPushEvents.apnsTokenReceived, token]];
  }
}

- (void)onAPNsToken:(NSNotification *)notification
{
  NSString *token = notification.userInfo[@"token"];
  if (!token) { return; }
  if (!_callableJSModules) {
    _pendingAPNsToken = token;
    return;
  }
  [_callableJSModules invokeModule:@"RCTDeviceEventEmitter"
                            method:@"emit"
                          withArgs:@[RNPingPushEvents.apnsTokenReceived, token]];
}

- (void)invalidate
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [[self swiftImpl] invalidate];
}

#pragma mark - Initialization

- (void)initialize:(NSDictionary *)config
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] initialize:config resolve:resolve rejecter:reject];
}

#pragma mark - Credential Operations

- (void)addCredentialFromUri:(NSString *)clientId
                         uri:(NSString *)uri
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] addCredentialFromUri:clientId uri:uri resolve:resolve rejecter:reject];
}

- (void)saveCredential:(NSString *)clientId
            credential:(NSDictionary *)credential
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] saveCredential:clientId credential:credential resolve:resolve rejecter:reject];
}

- (void)getCredentials:(NSString *)clientId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getCredentials:clientId resolve:resolve rejecter:reject];
}

- (void)getCredential:(NSString *)clientId
         credentialId:(NSString *)credentialId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getCredential:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)deleteCredential:(NSString *)clientId
            credentialId:(NSString *)credentialId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] deleteCredential:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

#pragma mark - Device Token Operations

- (void)setDeviceToken:(NSString *)clientId
                 token:(NSString *)token
          credentialId:(NSString *)credentialId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] setDeviceToken:clientId token:token credentialId:credentialId resolve:resolve rejecter:reject];
}

- (void)getDeviceToken:(NSString *)clientId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getDeviceToken:clientId resolve:resolve rejecter:reject];
}

#pragma mark - Notification Processing

- (void)processNotification:(NSString *)clientId
                messageData:(NSDictionary *)messageData
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] processNotification:clientId messageData:messageData resolve:resolve rejecter:reject];
}

- (void)processNotificationFromMessage:(NSString *)clientId
                               message:(NSString *)message
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] processNotificationFromMessage:clientId message:message resolve:resolve rejecter:reject];
}

#pragma mark - Notification Response Operations

- (void)approveNotification:(NSString *)clientId
             notificationId:(NSString *)notificationId
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] approveNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

- (void)approveChallengeNotification:(NSString *)clientId
                      notificationId:(NSString *)notificationId
                   challengeResponse:(NSString *)challengeResponse
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] approveChallengeNotification:clientId notificationId:notificationId challengeResponse:challengeResponse resolve:resolve rejecter:reject];
}

- (void)approveBiometricNotification:(NSString *)clientId
                      notificationId:(NSString *)notificationId
                authenticationMethod:(NSString *)authenticationMethod
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] approveBiometricNotification:clientId notificationId:notificationId authenticationMethod:authenticationMethod resolve:resolve rejecter:reject];
}

- (void)denyNotification:(NSString *)clientId
          notificationId:(NSString *)notificationId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] denyNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

#pragma mark - Notification Query Operations

- (void)getPendingNotifications:(NSString *)clientId
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getPendingNotifications:clientId resolve:resolve rejecter:reject];
}

- (void)getAllNotifications:(NSString *)clientId
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getAllNotifications:clientId resolve:resolve rejecter:reject];
}

- (void)getNotification:(NSString *)clientId
         notificationId:(NSString *)notificationId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] getNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

- (void)cleanupNotifications:(NSString *)clientId
                credentialId:(NSString *)credentialId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] cleanupNotifications:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

#pragma mark - Close

- (void)close:(NSString *)clientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] close:clientId resolve:resolve rejecter:reject];
}

- (void)consumePendingMessages:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] consumePendingMessagesWithResolve:resolve rejecter:reject];
}

- (void)refreshToken:(NSString *)clientId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] refreshToken:clientId resolve:resolve rejecter:reject];
}

#pragma mark - TurboModule

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingPushSpecJSI>(params);
}

@end
