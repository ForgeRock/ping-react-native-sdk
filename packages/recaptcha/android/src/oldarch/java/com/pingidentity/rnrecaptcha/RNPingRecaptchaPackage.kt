/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers the reCAPTCHA classic module package for Old Architecture builds.
 */
class RNPingRecaptchaPackage : BaseReactPackage() {

    /**
     * Creates the module instance when React Native requests it by name.
     *
     * @param name Requested module name.
     * @param reactContext React application context.
     * @return reCAPTCHA classic module instance when the name matches, otherwise null.
     */
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == RNPingRecaptchaClassicModule.NAME) {
            RNPingRecaptchaClassicModule(reactContext)
        } else {
            null
        }
    }

    /**
     * Describes module metadata used by the React Native runtime.
     *
     * @return Provider for reCAPTCHA module info.
     */
    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos = mutableMapOf<String, ReactModuleInfo>()
            moduleInfos[RNPingRecaptchaClassicModule.NAME] = ReactModuleInfo(
                RNPingRecaptchaClassicModule.NAME,
                RNPingRecaptchaClassicModule.NAME,
                false,
                false,
                false,
                false
            )
            moduleInfos
        }
    }
}
