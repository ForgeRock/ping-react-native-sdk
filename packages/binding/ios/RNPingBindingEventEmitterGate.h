/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Ensures only one of the two architecture-specific bridge modules
/// (`RNPingBinding` for new arch, `RNPingBindingClassic` for old arch)
/// subscribes to `RNPingBinding_NativeEmit` notifications and forwards them
/// to JS via `RCTDeviceEventEmitter`. Without this gate both modules would
/// subscribe simultaneously and every PIN / user-key event would fire twice
/// on the JS side.
///
/// Returns `YES` exactly once for the process lifetime; subsequent callers get `NO`.
FOUNDATION_EXPORT BOOL RNPingBindingClaimEventEmitterOwnership(NSString *ownerId);

NS_ASSUME_NONNULL_END
