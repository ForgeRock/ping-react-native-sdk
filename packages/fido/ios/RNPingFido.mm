/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingFido.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

/// Auto-generated Swift header.
#import "RNPingFido-Swift.h"

@implementation RNPingFido
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingFidoImpl *)swiftImpl
{
  return [RNPingFidoImpl shared];
}

/**
 Returns the default FIDO identifier.
 */
- (void)getDefaultFido:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  if ([NSThread isMainThread]) {
    [[self swiftImpl] getDefaultFido:resolve rejecter:reject];
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[self swiftImpl] getDefaultFido:resolve rejecter:reject];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingFidoSpecJSI>(params);
}

@end
