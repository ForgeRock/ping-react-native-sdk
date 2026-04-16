/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import "RNPingExternalIdp.h"

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

@implementation RNPingExternalIdp
RCT_EXPORT_MODULE()

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingExternalIdpSpecJSI>(params);
}

@end
