/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <RNPingRecaptchaSpec/RNPingRecaptchaSpec.h>

/**
 * @interface RNPingRecaptcha
 * @brief Turbo Module implementation for reCAPTCHA Enterprise.
 *
 * This interface defines the native reCAPTCHA module for React Native's
 * New Architecture. It conforms to the NativeRNPingRecaptchaSpec protocol
 * generated from the TurboModule spec.
 */
@interface RNPingRecaptcha : NSObject <NativeRNPingRecaptchaSpec>

@end
