/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// RNPingBindingEventEmitterGate
//
// Both RNPingBinding (new arch / TurboModule) and RNPingBindingClassic (old arch)
// can be loaded in the same process at startup. Each module wants to observe
// RNPingBinding_NativeEmit notifications and forward them to JS via
// RCTDeviceEventEmitter. Without coordination both would subscribe and every
// PIN / user-key event would fire twice on the JS side.
//
// RNPingBindingClaimEventEmitterOwnership lets whichever module initialises
// first claim the single forwarding slot (returns YES). The other module
// receives NO and stays silent. The Swift layer (RNPingBindingCommon.emitEvent)
// posts to NotificationCenter without caring which arch won.

#import "RNPingBindingEventEmitterGate.h"

static NSLock *RNPingBindingEventEmitterGateLock(void)
{
  static NSLock *lock = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    lock = [[NSLock alloc] init];
  });
  return lock;
}

BOOL RNPingBindingClaimEventEmitterOwnership(NSString *ownerId)
{
  (void)ownerId;
  NSLock *lock = RNPingBindingEventEmitterGateLock();
  [lock lock];
  static BOOL hasEventEmitterOwner = NO;
  BOOL didClaim = NO;
  if (!hasEventEmitterOwner) {
    hasEventEmitterOwner = YES;
    didClaim = YES;
  }
  [lock unlock];
  return didClaim;
}
