package com.reactnativepingidentity.storage

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class RNPingStoragePackage : BaseReactPackage() {

    // ------------------------------------------------------------
    // Detect New Architecture
    // ------------------------------------------------------------
    private val isNewArchEnabled: Boolean
        get() {
            val flag = System.getProperty("newArchEnabled") ?: "false"
            return flag.equals("true", ignoreCase = true)
        }

    // ------------------------------------------------------------
    // Return module instance based on arch
    // ------------------------------------------------------------
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            RNPingStorageModule.NAME -> {
                if (isNewArchEnabled) {
                    // --- Turbo path ---
                    RNPingStorageModule(reactContext)
                } else {
                    // --- Classic fallback ---
                    RNPingStorageClassicModule(reactContext)
                }
            }
            else -> null
        }
    }

    // ------------------------------------------------------------
    // ReactModuleInfo must change depending on architecture
    // ------------------------------------------------------------
    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()

            val isTurbo = isNewArchEnabled

            moduleInfos[RNPingStorageModule.NAME] = ReactModuleInfo(
                RNPingStorageModule.NAME,   // name
                RNPingStorageModule.NAME,   // className in JS
                false,                      // canOverrideExistingModule
                false,                      // needsEagerInit
                false,                      // isCxxModule
                isTurbo                     // isTurboModule
            )
            moduleInfos
        }
    }
}