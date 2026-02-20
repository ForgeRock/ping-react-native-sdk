/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <React/RCTBridgeModule.h>

#if __has_include("RNPingJourney-Swift.h")
#import "RNPingJourney-Swift.h"
#else
#import <RNPingJourney/RNPingJourney-Swift.h>
#endif

/**
 * Classic (non-Turbo) React Native module for Journey operations.
 *
 * This module keeps the Journey package compatible when TurboModule lookup
 * is unavailable at runtime.
 */
@interface RNPingJourneyClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingJourneyClassic

RCT_EXPORT_MODULE(RNPingJourneyClassic)

/**
 * Executes a block with the shared Swift implementation on the main thread.
 *
 * - Parameter block: Work item that receives the shared Swift bridge object.
 */
- (void)withSwiftImpl:(void (^)(RNPingJourneyImpl *impl))block
{
  if ([NSThread isMainThread]) {
    block([RNPingJourneyImpl shared]);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    block([RNPingJourneyImpl shared]);
  });
}

/**
 * Configures one Journey client instance.
 *
 * - Parameters:
 *   - config: Journey configuration dictionary.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(configureJourney:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl configureJourney:config resolver:resolve rejecter:reject];
  }];
}

/**
 * Starts a Journey by name.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - journeyName: Journey/tree name.
 *   - options: Optional start options dictionary.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(start:(NSString *)journeyId
                  journeyName:(NSString *)journeyName
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl start:journeyId
     journeyName:journeyName
         options:options
        resolver:resolve
        rejecter:reject];
  }];
}

/**
 * Submits callback input and advances to the next Journey node.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - nodeId: Legacy node identifier.
 *   - input: Callback input dictionary.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(next:(NSString *)journeyId
                  nodeId:(NSString *)nodeId
                  input:(NSDictionary *)input
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl next:journeyId nodeId:nodeId input:input resolver:resolve rejecter:reject];
  }];
}

/**
 * Resumes a suspended Journey.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - uri: Resume URI.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(resume:(NSString *)journeyId
                  uri:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl resume:journeyId uri:uri resolver:resolve rejecter:reject];
  }];
}

/**
 * Returns session details for the Journey client.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(getSession:(NSString *)journeyId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl getSession:journeyId resolver:resolve rejecter:reject];
  }];
}

/**
 * Logs out the current Journey user.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(logout:(NSString *)journeyId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl logout:journeyId
        resolver:^(BOOL value) {
          resolve(@(value));
        }
        rejecter:reject];
  }];
}

/**
 * Disposes native Journey state for one client.
 *
 * - Parameters:
 *   - journeyId: Journey client identifier.
 *   - resolve: Promise resolver.
 *   - reject: Promise rejecter.
 */
RCT_EXPORT_METHOD(dispose:(NSString *)journeyId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self withSwiftImpl:^(RNPingJourneyImpl *impl) {
    [impl dispose:journeyId
         resolver:^{
           resolve([NSNull null]);
         }
         rejecter:reject];
  }];
}

@end
