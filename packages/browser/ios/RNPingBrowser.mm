//
//  RNPingBrowser.mm
//  RNPingBrowser
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

#import "RNPingBrowser.h"
#import "RCTDefaultReactNativeFactoryDelegate.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#import "RNPingBrowser-Swift.h"

@implementation RNPingBrowser
RCT_EXPORT_MODULE()

// Helper to get the Swift singleton.
- (RNPingBrowserImpl *)swiftImpl
{
  return [RNPingBrowserImpl shared];
}

// configure(config): void
- (void)configure:(JS::NativeRNPingBrowser::NativeBrowserConfig &)config
{
  // iOS currently does not apply configuration; keep the hook for parity.
  [[self swiftImpl] configure:@{}];
}

// reset(): void
- (void)reset
{
  [[self swiftImpl] reset];
}

// open(url, options): Promise<BrowserResult>
- (void)open:(NSString *)url
     options:(NSDictionary *)options
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] open:url options:options resolver:resolve rejecter:reject];
}

// TurboModule provider.
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingBrowserSpecJSI>(params);
}

@end
