/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>

/**
 * Classic bridge module used when React Native New Architecture is disabled.
 */
@interface RNPingExternalIdpClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingExternalIdpClassic

RCT_EXPORT_MODULE(RNPingExternalIdpClassic)

@end
