/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecognize

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Recognize API on Android.
 *
 * All operations are delegated to [RNPingRecognizeCommon].
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingRecognizeModule.NAME)
class RNPingRecognizeModule(reactContext: ReactApplicationContext) :
    NativeRNPingRecognizeSpec(reactContext) {

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
        RNPingRecognizeCommon.cleanup()
        super.invalidate()
    }

    /**
     * Runs the Recognize enroll or authenticate step of an active Journey node.
     *
     * @param journeyId Native Journey instance id.
     * @param options Execution options payload (`index`, `retrieveSelfie`).
     * @param config Per-client configuration payload.
     * @param promise Resolved with the result payload or rejected on bridge-level failure.
     */
    override fun runForJourney(
        journeyId: String,
        options: ReadableMap,
        config: ReadableMap,
        promise: Promise
    ) {
        RNPingRecognizeCommon.runForJourney(journeyId, options, config, promise)
    }

    /**
     * Runs the Recognize enroll or authenticate collector of an active DaVinci node.
     *
     * @param davinciId Native DaVinci instance id.
     * @param options Execution options payload (`index`).
     * @param config Per-client configuration payload.
     * @param promise Resolved with the result payload or rejected on bridge-level failure.
     */
    override fun runForDaVinci(
        davinciId: String,
        options: ReadableMap,
        config: ReadableMap,
        promise: Promise
    ) {
        RNPingRecognizeCommon.runForDaVinci(davinciId, options, config, promise)
    }

    companion object {
        const val NAME = "RNPingRecognize"
    }
}
