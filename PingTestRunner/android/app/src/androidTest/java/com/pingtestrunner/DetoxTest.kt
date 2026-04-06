/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingtestrunner

import com.wix.detox.Detox
import com.wix.detox.config.DetoxConfig
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.ActivityTestRule
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class DetoxTest {

    @JvmField
    @Rule
    val activityTestRule = ActivityTestRule(MainActivity::class.java, false, false)

    @Test
    fun runDetoxTests() {
        val instrumentationArgs = InstrumentationRegistry.getArguments()
        // Disable Detox RN synchronization before the initial isReady handshake.
        // RN 0.80 bridgeless networking no longer exposes the reflected mClient
        // field expected by Detox's NetworkIdlingResource, which otherwise
        // crashes the instrumentation process during setup.
        instrumentationArgs.putString("detoxEnableSynchronization", "0")
        val detoxServer = instrumentationArgs.getString("detoxServer")
        if (!detoxServer.isNullOrBlank()) {
            val rewritten = detoxServer
                .replace("ws://localhost:", "ws://10.0.2.2:")
                .replace("ws://127.0.0.1:", "ws://10.0.2.2:")
            instrumentationArgs.putString("detoxServer", rewritten)
        }

        val detoxConfig = DetoxConfig()
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60
        Detox.runTests(activityTestRule, detoxConfig)
    }
}
