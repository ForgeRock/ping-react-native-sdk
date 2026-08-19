/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.config

/**
 * Parsed Protect lifecycle module configuration supplied by JavaScript.
 *
 * Mirrors the `DaVinciProtectModuleConfig` TypeScript type and maps to
 * `ProtectLifecycleConfig` in the native Protect SDK.
 */
internal data class ProtectLifecyclePayload(
    /** PingOne environment ID for the Protect SDK. */
    val envId: String?,
    /** Whether to enable behavioral data collection. Default: true. */
    val isBehavioralDataCollection: Boolean,
    /** Whether to use lazy metadata loading. Default: false. */
    val isLazyMetadata: Boolean,
    /** Custom host URL for the Protect SDK. */
    val customHost: String?,
    /** Whether to enable console logging inside the Protect SDK. Default: false. */
    val isConsoleLogEnabled: Boolean,
    /** Device attributes to exclude from signal collection. */
    val deviceAttributesToIgnore: List<String>,
    /** Whether to pause behavioral data collection on successful authentication. Default: false. */
    val pauseBehavioralDataOnSuccess: Boolean,
    /** Whether to resume behavioral data collection when the flow starts. Default: false. */
    val resumeBehavioralDataOnStart: Boolean,
    /** Optional logger handle id from JS for Protect operations. */
    val loggerId: String?,
)
