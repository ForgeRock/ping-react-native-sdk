/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.logger

import com.pingidentity.rncore.registry.NativeHandle

/**
 * Shared native handle contract that exposes logger configuration values.
 *
 * @remarks
 * Modules that need to apply logger settings (for example OIDC and Journey)
 * can resolve this handle from `CoreRuntime.loggerRegistry` without depending
 * on logger package internals.
 */
interface LoggerHandleContract : NativeHandle {
    /**
     * Native logger level value.
     *
     * Expected values are `STANDARD`, `WARN`, and `NONE`.
     */
    val loggerLevel: String

    /**
     * Native logger instance bound to this handle.
     *
     * The returned logger may be mutable (for example a delegating logger that
     * reflects runtime level changes from `changeLevel`).
     */
    val nativeLogger: Any
}
