/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.reactnative.rnstorage

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

/**
 * React Native package for Ping Storage.
 *
 * Provides the appropriate module implementation based on the architecture.
 * Supports both Classic and New Architecture (Turbo Modules).
 */
class RNPingStoragePackage : BaseReactPackage() {

    /**
     * Detect if New Architecture is enabled.
     *
     * @return true if the newArchEnabled system property is set to "true", false otherwise
     */
    private val isNewArchEnabled: Boolean
        get() {
            val flag = System.getProperty("newArchEnabled") ?: "false"
            return flag.equals("true", ignoreCase = true)
        }

    /**
     * Return module instance based on architecture.
     *
     * @param name Module name to create
     * @param reactContext React application context
     * @return [NativeModule] instance or null if name doesn't match
     */
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            RNPingStorageModule.NAME -> {
                if (isNewArchEnabled) {
                    // Turbo Module path (New Architecture)
                    RNPingStorageModule(reactContext)
                } else {
                    // Classic Module fallback (Old Architecture)
                    RNPingStorageClassicModule(reactContext)
                }
            }
            else -> null
        }
    }

    /**
     * Provide ReactModuleInfo based on architecture.
     *
     * @return [ReactModuleInfoProvider] with module information including Turbo Module flag
     */
    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()

            val isTurbo = isNewArchEnabled

            if (isTurbo) {
                moduleInfos[RNPingStorageModule.NAME] = ReactModuleInfo(
                    RNPingStorageModule.NAME,   // name
                    RNPingStorageModule.NAME,   // className in JS
                    false,                      // canOverrideExistingModule
                    false,                      // needsEagerInit
                    false,                      // isCxxModule
                    true                        // isTurboModule
                )
            } else {
                moduleInfos[RNPingStorageClassicModule.NAME] = ReactModuleInfo(
                    RNPingStorageClassicModule.NAME, // name
                    RNPingStorageClassicModule.NAME, // className in JS
                    false,                           // canOverrideExistingModule
                    false,                           // needsEagerInit
                    false,                           // isCxxModule
                    false                            // isTurboModule
                )
            }
            moduleInfos
        }
    }
}
