/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Marker protocol for native objects that can be tracked in a `Registry`.
///
/// Implementations represent platform resources that should be resolvable by id.
public protocol NativeHandle: AnyObject {}
