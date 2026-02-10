/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <RNPingDeviceIdSpec/RNPingDeviceIdSpec.h>

/**
 * @interface RNPingDeviceId
 * @brief Turbo Module implementation for Device ID.
 *
 * This interface defines the native device ID module for React Native's
 * New Architecture. It conforms to the NativeRNPingDeviceIdSpec protocol
 * generated from the TurboModule spec.
 */
@interface RNPingDeviceId : NSObject <NativeRNPingDeviceIdSpec>

@end
