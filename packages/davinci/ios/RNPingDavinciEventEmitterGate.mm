/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// RNPingDavinciEventEmitterGate
//
// Both RNPingDavinci (new arch / TurboModule) and RNPingDavinciClassic (old arch)
// can be loaded in the same process at startup. Each module wants to observe
// RNPingDavinci_NativeEmit notifications and forward them to JS via
// RCTDeviceEventEmitter. Without coordination both would subscribe and every
// polling status event would fire twice on the JS side.
//
// RNPingDavinciClaimEventEmitterOwnership lets whichever module initialises
// first claim the single forwarding slot (returns YES). The other module
// receives NO and stays silent. The owner releases the slot on teardown via
// RNPingDavinciReleaseEventEmitterOwnership, so a module instance recreated
// after a bridge reload can reclaim it. The Swift layer
// (RNPingDavinciCommon.emitEvent) posts to NotificationCenter without caring
// which arch won.

#import "RNPingDavinciEventEmitterGate.h"

static NSLock *RNPingDavinciEventEmitterGateLock(void)
{
  static NSLock *lock = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    lock = [[NSLock alloc] init];
  });
  return lock;
}

static NSString *_Nullable gRNPingDavinciEventEmitterOwnerId = nil;

BOOL RNPingDavinciClaimEventEmitterOwnership(NSString *ownerId)
{
  NSLock *lock = RNPingDavinciEventEmitterGateLock();
  [lock lock];
  BOOL didClaim = NO;
  if (gRNPingDavinciEventEmitterOwnerId == nil) {
    gRNPingDavinciEventEmitterOwnerId = [ownerId copy];
    didClaim = YES;
  }
  [lock unlock];
  return didClaim;
}

void RNPingDavinciReleaseEventEmitterOwnership(NSString *ownerId)
{
  NSLock *lock = RNPingDavinciEventEmitterGateLock();
  [lock lock];
  if ([gRNPingDavinciEventEmitterOwnerId isEqualToString:ownerId]) {
    gRNPingDavinciEventEmitterOwnerId = nil;
  }
  [lock unlock];
}
