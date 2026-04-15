/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <RNPingFidoSpec/RNPingFidoSpec.h>

/**
 * @interface RNPingFido
 * @brief Turbo Module implementation for FIDO.
 *
 * This interface defines the native FIDO module for React Native's
 * New Architecture. It conforms to the NativeRNPingFidoSpec protocol
 * generated from the TurboModule spec.
 */
@interface RNPingFido : NSObject <NativeRNPingFidoSpec>

@end
