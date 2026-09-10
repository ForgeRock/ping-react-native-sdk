/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import "RNPingOidcEventEmitterGate.h"

static NSLock *RNPingOidcEventEmitterGateLock(void)
{
  static NSLock *lock;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{ lock = [NSLock new]; });
  return lock;
}

static NSString *gRNPingOidcEventEmitterOwnerId;

BOOL RNPingOidcClaimEventEmitterOwnership(NSString *ownerId)
{
  NSLock *lock = RNPingOidcEventEmitterGateLock();
  [lock lock];
  BOOL claimed = NO;
  if (gRNPingOidcEventEmitterOwnerId == nil) {
    gRNPingOidcEventEmitterOwnerId = [ownerId copy];
    claimed = YES;
  }
  [lock unlock];
  return claimed;
}

void RNPingOidcReleaseEventEmitterOwnership(NSString *ownerId)
{
  NSLock *lock = RNPingOidcEventEmitterGateLock();
  [lock lock];
  if ([gRNPingOidcEventEmitterOwnerId isEqualToString:ownerId]) {
    gRNPingOidcEventEmitterOwnerId = nil;
  }
  [lock unlock];
}
