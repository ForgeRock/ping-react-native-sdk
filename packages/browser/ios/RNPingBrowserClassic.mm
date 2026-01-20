//
//  RNPingBrowserClassic.mm
//  RNPingBrowser
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

#import <React/RCTBridgeModule.h>
#import "RNPingBrowser-Swift.h"

/// React Native bridge module for classic (non-TurboModule) access.
@interface RNPingBrowserClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingBrowserClassic

RCT_EXPORT_MODULE(RNPingBrowserClassic)

#pragma mark - Configure (no-op on iOS)

/// Receives configuration from JavaScript (currently a no-op on iOS).
RCT_EXPORT_METHOD(configure:(NSDictionary *)config)
{
  [RNPingBrowserCommon configure:config];
}

#pragma mark - Open

/// Launches a browser flow and resolves or rejects the JS promise.
RCT_EXPORT_METHOD(open:(NSString *)url
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingBrowserCommon open:url options:options resolver:resolve rejecter:reject];
}

#pragma mark - Reset

/// Cancels any in-flight browser session when supported.
RCT_EXPORT_METHOD(reset)
{
  [RNPingBrowserCommon reset];
}

@end
