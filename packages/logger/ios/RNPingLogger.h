/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <RNPingLoggerSpec/RNPingLoggerSpec.h>

/**
 * @interface Logger
 * @brief Turbo Module implementation for PingLogger
 *
 * This interface defines the native logger module for React Native's New Architecture.
 * It conforms to the NativeRNPingLoggerSpec protocol generated from the TurboModule spec.
 */
@interface Logger : NSObject <NativeRNPingLoggerSpec>

@end
