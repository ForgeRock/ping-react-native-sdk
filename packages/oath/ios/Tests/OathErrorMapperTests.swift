/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOath
@testable import RNPingOath

final class OathErrorMapperTests: XCTestCase {

  // MARK: - OathError cases

  func test_mapOathError_credentialNotFound() {
    let mapped = OathErrorMapper.mapError(OathError.credentialNotFound("cred missing"))
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, OathErrorCodes.credentialNotFound.rawValue)
    XCTAssertEqual(mapped.message, "cred missing")
  }

  func test_mapOathError_credentialLocked() {
    let mapped = OathErrorMapper.mapError(OathError.credentialLocked("cred locked"))
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, OathErrorCodes.credentialLocked.rawValue)
    XCTAssertEqual(mapped.message, "cred locked")
  }

  func test_mapOathError_duplicateCredential() {
    let mapped = OathErrorMapper.mapError(OathError.duplicateCredential(issuer: "Acme", accountName: "user@acme.com"))
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, OathErrorCodes.duplicateCredential.rawValue)
  }

  func test_mapOathError_invalidUri() {
    let mapped = OathErrorMapper.mapError(OathError.invalidUri("bad uri"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.invalidUri.rawValue)
    XCTAssertEqual(mapped.message, "bad uri")
  }

  func test_mapOathError_missingRequiredParameter() {
    let mapped = OathErrorMapper.mapError(OathError.missingRequiredParameter("secret missing"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.missingParameter.rawValue)
    XCTAssertEqual(mapped.message, "secret missing")
  }

  func test_mapOathError_invalidParameterValue() {
    let mapped = OathErrorMapper.mapError(OathError.invalidParameterValue("digits invalid"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.invalidParameter.rawValue)
    XCTAssertEqual(mapped.message, "digits invalid")
  }

  func test_mapOathError_invalidSecret() {
    let mapped = OathErrorMapper.mapError(OathError.invalidSecret("bad secret"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.invalidParameter.rawValue)
    XCTAssertEqual(mapped.message, "bad secret")
  }

  func test_mapOathError_invalidOathType() {
    let mapped = OathErrorMapper.mapError(OathError.invalidOathType("unknown type"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.invalidParameter.rawValue)
    XCTAssertEqual(mapped.message, "unknown type")
  }

  func test_mapOathError_invalidAlgorithm() {
    let mapped = OathErrorMapper.mapError(OathError.invalidAlgorithm("bad algo"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.invalidParameter.rawValue)
    XCTAssertEqual(mapped.message, "bad algo")
  }

  func test_mapOathError_uriFormatting() {
    let mapped = OathErrorMapper.mapError(OathError.uriFormatting("format error"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, OathErrorCodes.uriFormatting.rawValue)
    XCTAssertEqual(mapped.message, "format error")
  }

  func test_mapOathError_codeGenerationFailed() {
    let underlying = NSError(domain: "Test", code: 0)
    let mapped = OathErrorMapper.mapError(OathError.codeGenerationFailed("gen failed", underlying))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.codeGenerationFailed.rawValue)
    XCTAssertEqual(mapped.message, "gen failed")
  }

  func test_mapOathError_policyViolation() {
    let mapped = OathErrorMapper.mapError(OathError.policyViolation("lockout", "too many attempts"))
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, OathErrorCodes.policyViolation.rawValue)
  }

  func test_mapOathError_initializationFailed() {
    let underlying = NSError(domain: "Test", code: 0)
    let mapped = OathErrorMapper.mapError(OathError.initializationFailed("init error", underlying))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.initializationFailed.rawValue)
    XCTAssertEqual(mapped.message, "init error")
  }

  func test_mapOathError_cleanupFailed() {
    let underlying = NSError(domain: "Test", code: 0)
    let mapped = OathErrorMapper.mapError(OathError.cleanupFailed("cleanup error", underlying))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.cleanupFailed.rawValue)
    XCTAssertEqual(mapped.message, "cleanup error")
  }

  // MARK: - OathStorageError cases

  func test_mapStorageError_storageFailure() {
    let underlying = NSError(domain: "Storage", code: 1)
    let mapped = OathErrorMapper.mapError(OathStorageError.storageFailure("write failed", underlying))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.storageFailed.rawValue)
    XCTAssertEqual(mapped.message, "write failed")
  }

  func test_mapStorageError_duplicateCredential() {
    let mapped = OathErrorMapper.mapError(OathStorageError.duplicateCredential("already exists"))
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, OathErrorCodes.duplicateCredential.rawValue)
    XCTAssertEqual(mapped.message, "already exists")
  }

  func test_mapStorageError_storageCorrupted() {
    let mapped = OathErrorMapper.mapError(OathStorageError.storageCorrupted("db corrupted"))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.storageCorrupted.rawValue)
    XCTAssertEqual(mapped.message, "db corrupted")
  }

  func test_mapStorageError_accessDenied() {
    let mapped = OathErrorMapper.mapError(OathStorageError.accessDenied("no permission"))
    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OathErrorCodes.storageAccessDenied.rawValue)
    XCTAssertEqual(mapped.message, "no permission")
  }

  // MARK: - Generic fallback

  func test_unknownError_fallsBackToUnknown() {
    let generic = NSError(domain: "Anywhere", code: 99, userInfo: [NSLocalizedDescriptionKey: "unexpected"])
    let mapped = OathErrorMapper.mapError(generic)
    XCTAssertEqual(mapped.type, .unknownError)
    XCTAssertEqual(mapped.error, OathErrorCodes.unknown.rawValue)
  }
}
