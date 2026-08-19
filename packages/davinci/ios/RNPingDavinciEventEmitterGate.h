/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Ensures only one of the two architecture-specific bridge modules
/// (`RNPingDavinci` for new arch, `RNPingDavinciClassic` for old arch)
/// subscribes to `RNPingDavinci_NativeEmit` notifications and forwards them
/// to JS via `RCTDeviceEventEmitter`. Without this gate both modules would
/// subscribe simultaneously and every polling status event would fire twice
/// on the JS side.
///
/// Returns `YES` if `ownerId` is not already held by another owner; `NO` otherwise.
FOUNDATION_EXPORT BOOL RNPingDavinciClaimEventEmitterOwnership(NSString *ownerId);

/// Releases the event-emitter ownership slot previously claimed by `ownerId`,
/// allowing a subsequent `RNPingDavinciClaimEventEmitterOwnership` call (e.g. from a
/// module instance recreated after a bridge reload) to succeed. No-op if `ownerId`
/// does not currently hold the slot.
FOUNDATION_EXPORT void RNPingDavinciReleaseEventEmitterOwnership(NSString *ownerId);

NS_ASSUME_NONNULL_END
