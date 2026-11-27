/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <string>
#import "RNPingRecognize.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#if __has_include("RNPingRecognize-Swift.h")
#import "RNPingRecognize-Swift.h"
#else
#import <RNPingRecognize/RNPingRecognize-Swift.h>
#endif

@implementation RNPingRecognize
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingRecognizeImpl *)swiftImpl
{
  return [RNPingRecognizeImpl shared];
}

/**
 Runs the active Journey PingOneRecognizeCallback resolved from a Journey
 instance id. Both ceremony outcomes resolve; only bridge-level failures
 reject.
 */
- (void)runForJourney:(NSString *)journeyId
              options:(NSDictionary *)options
               config:(NSDictionary *)config
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] runForJourney:journeyId
                          options:options
                           config:config
                          resolve:resolve
                         rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingRecognizeSpecJSI>(params);
}

@end
