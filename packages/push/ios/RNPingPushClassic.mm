/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>
#if __has_include("RNPingPush-Swift.h")
#import "RNPingPush-Swift.h"
#else
#import <RNPingPush/RNPingPush-Swift.h>
#endif

/**
 * @interface RNPingPushClassic
 * @brief Classic (non-Turbo) React Native module for Push.
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingPushClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingPushClassic
 * @brief Implementation of the classic Push bridge module.
 */
@implementation RNPingPushClassic {
  NSString *_pendingAPNsToken;
}

@synthesize callableJSModules = _callableJSModules;

RCT_EXPORT_MODULE(RNPingPushClassic)

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
  [[RNPingPushImpl shared] invalidate];
}

#pragma mark - Initialization

RCT_EXPORT_METHOD(initialize:(NSDictionary *)config
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] initialize:config resolve:resolve rejecter:reject];
}

#pragma mark - Credential Operations

RCT_EXPORT_METHOD(addCredentialFromUri:(NSString *)clientId
                  uri:(NSString *)uri
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] addCredentialFromUri:clientId uri:uri resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(saveCredential:(NSString *)clientId
                  credential:(NSDictionary *)credential
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] saveCredential:clientId credential:credential resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getCredentials:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getCredentials:clientId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getCredential:(NSString *)clientId
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getCredential:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(deleteCredential:(NSString *)clientId
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] deleteCredential:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

#pragma mark - Device Token Operations

RCT_EXPORT_METHOD(setDeviceToken:(NSString *)clientId
                  token:(NSString *)token
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] setDeviceToken:clientId token:token credentialId:credentialId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getDeviceToken:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getDeviceToken:clientId resolve:resolve rejecter:reject];
}

#pragma mark - Notification Processing

RCT_EXPORT_METHOD(processNotification:(NSString *)clientId
                  messageData:(NSDictionary *)messageData
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] processNotification:clientId messageData:messageData resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(processNotificationFromMessage:(NSString *)clientId
                  message:(NSString *)message
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] processNotificationFromMessage:clientId message:message resolve:resolve rejecter:reject];
}

#pragma mark - Notification Response Operations

RCT_EXPORT_METHOD(approveNotification:(NSString *)clientId
                  notificationId:(NSString *)notificationId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] approveNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(approveChallengeNotification:(NSString *)clientId
                  notificationId:(NSString *)notificationId
                  challengeResponse:(NSString *)challengeResponse
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] approveChallengeNotification:clientId notificationId:notificationId challengeResponse:challengeResponse resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(approveBiometricNotification:(NSString *)clientId
                  notificationId:(NSString *)notificationId
                  authenticationMethod:(NSString *)authenticationMethod
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] approveBiometricNotification:clientId notificationId:notificationId authenticationMethod:authenticationMethod resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(denyNotification:(NSString *)clientId
                  notificationId:(NSString *)notificationId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] denyNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

#pragma mark - Notification Query Operations

RCT_EXPORT_METHOD(getPendingNotifications:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getPendingNotifications:clientId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getAllNotifications:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getAllNotifications:clientId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(getNotification:(NSString *)clientId
                  notificationId:(NSString *)notificationId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] getNotification:clientId notificationId:notificationId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(cleanupNotifications:(NSString *)clientId
                  credentialId:(NSString *)credentialId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] cleanupNotifications:clientId credentialId:credentialId resolve:resolve rejecter:reject];
}

#pragma mark - Close

RCT_EXPORT_METHOD(close:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] close:clientId resolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(consumePendingMessages:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] consumePendingMessagesWithResolve:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(refreshToken:(NSString *)clientId
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[RNPingPushImpl shared] refreshToken:clientId resolve:resolve rejecter:reject];
}

@end
