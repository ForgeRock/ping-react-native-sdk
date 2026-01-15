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

@interface RNPingBrowserClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingBrowserClassic

RCT_EXPORT_MODULE(RNPingBrowserClassic)

#pragma mark - Configure (no-op on iOS)

// configure(config): void
RCT_EXPORT_METHOD(configure:(NSDictionary *)config)
{
  [RNPingBrowserCommon configure:config];
}

#pragma mark - Open

// open(url, options): Promise<BrowserResult>
RCT_EXPORT_METHOD(open:(NSString *)url
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [RNPingBrowserCommon open:url options:options resolver:resolve rejecter:reject];
}

#pragma mark - Reset

// reset(): void
RCT_EXPORT_METHOD(reset)
{
  [RNPingBrowserCommon reset];
}

@end
