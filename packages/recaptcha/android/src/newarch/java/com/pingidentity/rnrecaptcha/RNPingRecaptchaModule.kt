/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the reCAPTCHA API on Android.
 *
 * All operations are delegated to [RNPingRecaptchaCommon] for shared
 * implementation across architectures.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingRecaptchaModule.NAME)
class RNPingRecaptchaModule(reactContext: ReactApplicationContext) :
    NativeRNPingRecaptchaSpec(reactContext) {

    init {
        RNPingRecaptchaCommon.configure(reactContext)
    }

    /**
     * Return the module name exposed to the React Native bridge.
     *
     * @return Registered module name.
     */
    override fun getName(): String = NAME

    /**
     * Releases shared runtime state when the module is invalidated.
     */
    override fun invalidate() {
        RNPingRecaptchaCommon.cleanup()
        super.invalidate()
    }

    /**
     * Executes an active Journey ReCaptchaEnterpriseCallback.
     *
     * @param journeyId Native Journey instance id.
     * @param options Callback execution options payload.
     * @param config Per-call configuration payload.
     * @param promise React Native promise resolved with the result payload or
     *   rejected on bridge-level failure.
     */
    override fun verifyForJourney(
        journeyId: String,
        options: ReadableMap,
        config: ReadableMap,
        promise: Promise
    ) {
        RNPingRecaptchaCommon.verifyForJourney(journeyId, options, config, promise)
    }

    companion object {
        const val NAME = "RNPingRecaptcha"
    }
}
