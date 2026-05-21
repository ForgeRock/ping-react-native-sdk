/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import PingPush
import RNPingCore

// MARK: - Credential serialization

/// Converts a native `PushCredential` to a bridge-safe dictionary.
///
/// The `sharedSecret` field is intentionally omitted to avoid leaking
/// sensitive key material across the RN bridge.
func serializeCredential(_ cred: PushCredential) -> [String: Any] {
  var dict: [String: Any] = [:]
  dict["id"] = cred.id
  dict["userId"] = cred.userId as Any? ?? NSNull()
  dict["resourceId"] = cred.resourceId as Any? ?? NSNull()
  dict["issuer"] = cred.issuer
  dict["displayIssuer"] = cred.displayIssuer as Any? ?? NSNull()
  dict["accountName"] = cred.accountName
  dict["displayAccountName"] = cred.displayAccountName as Any? ?? NSNull()
  dict["serverEndpoint"] = cred.serverEndpoint as Any? ?? NSNull()
  dict["createdAt"] = cred.createdAt.timeIntervalSince1970 * 1000
  dict["imageURL"] = cred.imageURL as Any? ?? NSNull()
  dict["backgroundColor"] = cred.backgroundColor as Any? ?? NSNull()
  dict["policies"] = cred.policies as Any? ?? NSNull()
  dict["lockingPolicy"] = cred.lockingPolicy as Any? ?? NSNull()
  dict["isLocked"] = cred.isLocked
  dict["platform"] = serializePlatform(cred.platform)
  // sharedSecret NEVER included — bridge security contract
  return dict
}

/// Reconstructs a `PushCredential` from a bridge dictionary.
///
/// - Throws: `NSError` (via `ReadableMapUtils`) when `id`, `issuer`, or `accountName` is absent.
func deserializeCredential(_ dict: NSDictionary) throws -> PushCredential {
  let id = try ReadableMapUtils.requireString(dict, key: "id")
  let issuer = try ReadableMapUtils.requireString(dict, key: "issuer")
  let accountName = try ReadableMapUtils.requireString(dict, key: "accountName")

  // TODO-PUSH-PARITY: sharedSecret is non-optional on Android PushCredential but not required
  // here on iOS — Android SDK should make it optional so saveCredential round-trips work without
  // a placeholder empty string.
  return PushCredential(
    id: id,
    userId: dict["userId"] as? String,
    resourceId: dict["resourceId"] as? String,
    issuer: issuer,
    displayIssuer: dict["displayIssuer"] as? String,
    accountName: accountName,
    displayAccountName: dict["displayAccountName"] as? String,
    serverEndpoint: dict["serverEndpoint"] as? String ?? "",
    sharedSecret: "",
    createdAt: Date(timeIntervalSince1970: ((dict["createdAt"] as? NSNumber)?.doubleValue ?? 0) / 1000),
    imageURL: dict["imageURL"] as? String,
    backgroundColor: dict["backgroundColor"] as? String,
    policies: dict["policies"] as? String,
    lockingPolicy: dict["lockingPolicy"] as? String,
    isLocked: dict["isLocked"] as? Bool ?? false,
    platform: parsePlatform(dict["platform"] as? String)
  )
}

// MARK: - Notification serialization

/// Converts a native `PushNotification` to a bridge-safe dictionary.
func serializeNotification(_ n: PushNotification) -> [String: Any] {
  var dict: [String: Any] = [:]
  dict["id"] = n.id
  dict["credentialId"] = n.credentialId
  dict["ttl"] = n.ttl
  dict["messageId"] = n.messageId
  dict["messageText"] = n.messageText as Any? ?? NSNull()
  dict["customPayload"] = n.customPayload as Any? ?? NSNull()
  dict["challenge"] = n.challenge as Any? ?? NSNull()
  dict["numbersChallenge"] = n.numbersChallenge as Any? ?? NSNull()
  dict["loadBalancer"] = n.loadBalancer as Any? ?? NSNull()
  dict["contextInfo"] = n.contextInfo as Any? ?? NSNull()
  dict["pushType"] = n.type
  dict["createdAt"] = n.createdAt.timeIntervalSince1970 * 1000
  dict["sentAt"] = n.sentAt.map { $0.timeIntervalSince1970 * 1000 } as Any? ?? NSNull()
  dict["respondedAt"] = n.respondedAt.map { $0.timeIntervalSince1970 * 1000 } as Any? ?? NSNull()
  dict["approved"] = n.approved
  dict["pending"] = n.pending
  return dict
}

// MARK: - Platform

/// Maps an optional JS platform string (`"PING_AM"`, `"PING_ONE"`) to `PushPlatform`.
///
/// Unrecognized or absent values fall back to `.pingAM`.
func parsePlatform(_ value: String?) -> PushPlatform {
  // Only one platform exists in the native SDK currently; default to it.
  return .pingAM
}

/// Maps a native `PushPlatform` to the JS contract string (`"PING_AM"`, `"PING_ONE"`).
func serializePlatform(_ platform: PushPlatform) -> String {
  switch platform {
  case .pingAM:
    return "PING_AM"
  }
}
