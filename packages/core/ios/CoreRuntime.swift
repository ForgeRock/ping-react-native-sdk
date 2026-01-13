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
    /// Registry for session storage instances (used by Journey for SSO tokens)
    public static let sessionStorageRegistry: Registry = SimpleRegistry()
    
    /// Registry for OIDC storage instances (used for OAuth/OIDC tokens)
    public static let oidcStorageRegistry: Registry = SimpleRegistry()
    
    // public static let mfaRegistry: Registry = SimpleRegistry()
}
