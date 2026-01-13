// /*
//  * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//  *
//  * This software may be modified and distributed under the terms
//  * of the MIT license. See the LICENSE file for details.
//  */

// import Foundation
// import PingJourney

// @available(iOS 16.0, *)
// public final class JourneyRegistry { // TODO Make Actor

//     public static let shared = JourneyRegistry()

//     // Maps instanceId → Journey object
//     private var instances: [String: Journey] = [:]

//     private init() {}

//     /// Register a Journey instance and return an ID
//     @discardableResult
//     public func add(_ journey: Journey) -> String {
//         let id = UUID().uuidString
//         instances[id] = journey
//         return id
//     }

//     /// Retrieve a stored Journey instance
//     public func get(_ id: String) -> Journey? {
//         return instances[id]
//     }

//     /// Remove an instance manually
//     public func remove(_ id: String) {
//         instances.removeValue(forKey: id)
//     }

//     /// Return all registered IDs
//     public func listIds() -> [String] {
//         return Array(instances.keys)
//     }
// }
