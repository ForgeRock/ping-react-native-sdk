/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Central place to hold process-wide registries used by the core module.
///
/// Keeps native handles alive across calls from the React Native bridge.
public enum CoreRuntime {
    public static let storageRegistry: Registry = SimpleRegistry()
    // public static let mfaRegistry: Registry = SimpleRegistry()
}
