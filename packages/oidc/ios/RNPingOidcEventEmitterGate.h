/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <Foundation/Foundation.h>

FOUNDATION_EXPORT BOOL RNPingOidcClaimEventEmitterOwnership(NSString *ownerId);
FOUNDATION_EXPORT void RNPingOidcReleaseEventEmitterOwnership(NSString *ownerId);
