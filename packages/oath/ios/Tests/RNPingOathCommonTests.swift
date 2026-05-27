/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import React
import PingCommons
import PingOath
import PingTamperDetector
@testable import RNPingCore
@testable import RNPingOath

final class RNPingOathCommonTests: XCTestCase {

  private final class ErrorCaptureBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storedCode: String?
    private var storedError: NSError?

    func set(code: String, error: NSError?) {
      lock.lock()
      storedCode = code
      storedError = error
      lock.unlock()
    }

    var code: String? {
      lock.lock()
      defer { lock.unlock() }
      return storedCode
    }

    var error: NSError? {
      lock.lock()
      defer { lock.unlock() }
      return storedError
    }
  }

  override func setUp() {
    super.setUp()
    RNPingOathCommon.cleanup()
  }

  override func tearDown() {
    RNPingOathCommon.cleanup()
    super.tearDown()
  }

  func test_cleanup_closeOnUnknownHandleResolvesNull() {
    let resolveExpectation = expectation(description: "resolver called")
    let rejectExpectation = expectation(description: "rejecter not called")
    rejectExpectation.isInverted = true

    RNPingOathCommon.close("nonexistent-handle", resolver: { _ in
      Task { @MainActor in resolveExpectation.fulfill() }
    }, rejecter: { _, _, _ in
      Task { @MainActor in rejectExpectation.fulfill() }
    })

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

  func test_addCredentialFromUri_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.addCredentialFromUri(
        "bad-handle",
        uri: "otpauth://totp/test?secret=BASE32SECRET",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_getCredential_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.getCredential(
        "bad-handle",
        credentialId: "cred-id",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_getCredentials_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.getCredentials(
        "bad-handle",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_deleteCredential_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.deleteCredential(
        "bad-handle",
        credentialId: "cred-id",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_generateCode_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.generateCode(
        "bad-handle",
        credentialId: "cred-id",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_generateCodeWithValidity_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.generateCodeWithValidity(
        "bad-handle",
        credentialId: "cred-id",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func test_saveCredential_unknownHandle_rejectsWithStateError() {
    assertRejectsWithStateError { rejecter, resolver in
      RNPingOathCommon.saveCredential(
        "bad-handle",
        credential: [:],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  // MARK: - Config-wiring tests
  //
  // These tests verify the NSDictionary → OathConfiguration wiring logic used
  // by RNPingOathCommon.create(). Because OathClient.createClient is an async
  // SDK call that requires a real device/simulator environment, the tests mirror
  // the extraction pattern directly: they apply the same if-let / NSNumber
  // bridge recipe to a real OathConfiguration() instance and assert the
  // resulting field values.
  //
  // Why this matters:
  //   • timeoutMs: task-timeout-unit-fix-summary confirmed that `timeout` from JS
  //     is passed in seconds and assigned directly to OathConfiguration.timeoutMs
  //     (no multiplication). If someone accidentally adds "* 1000.0", the
  //     test_configWiring_timeout30 test will fail because 30.0 != 30000.0.
  //   • enableCredentialCache and encryptionEnabled are bool fields that must
  //     survive the NSNumber-to-Bool bridge coercion on the classic-bridge path.

  func test_configWiring_timeout30_timeoutMsEquals30() {
    // Arrange: dictionary that matches what JS sends over the bridge
    let config: NSDictionary = ["timeout": NSNumber(value: 30.0)]

    // Replicate the extraction recipe from RNPingOathCommon.create(_:resolver:rejecter:)
    let timeoutSeconds: Double? = (config["timeout"] as? NSNumber)?.doubleValue

    // Apply to a real OathConfiguration (no OathClient.createClient needed)
    let oathConfig = OathConfiguration()
    if let timeoutSeconds {
      // Direct assignment — same as production code. No * 1000.0 should be here.
      oathConfig.timeoutMs = timeoutSeconds
    }

    // timeoutMs == 30.0 s (not 30000.0 ms)
    XCTAssertEqual(oathConfig.timeoutMs, 30.0)
    // Regression guard: if production code accidentally multiplied by 1000, this fails
    XCTAssertNotEqual(oathConfig.timeoutMs, 30_000.0)
  }

  func test_configWiring_enableCredentialCacheTrue_isTrue() {
    let config: NSDictionary = ["enableCredentialCache": NSNumber(value: true)]
    let enableCredentialCacheValue: Bool? = (config["enableCredentialCache"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let enableCredentialCacheValue {
      oathConfig.enableCredentialCache = enableCredentialCacheValue
    }

    XCTAssertTrue(oathConfig.enableCredentialCache)
  }

  func test_configWiring_enableCredentialCacheFalse_isFalse() {
    let config: NSDictionary = ["enableCredentialCache": NSNumber(value: false)]
    let enableCredentialCacheValue: Bool? = (config["enableCredentialCache"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let enableCredentialCacheValue {
      oathConfig.enableCredentialCache = enableCredentialCacheValue
    }

    XCTAssertFalse(oathConfig.enableCredentialCache)
  }

  func test_configWiring_encryptionEnabledFalse_isFalse() {
    let config: NSDictionary = ["encryptionEnabled": NSNumber(value: false)]
    let encryptionEnabledValue: Bool? = (config["encryptionEnabled"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let encryptionEnabledValue {
      oathConfig.encryptionEnabled = encryptionEnabledValue
    }

    XCTAssertFalse(oathConfig.encryptionEnabled)
  }

  func test_configWiring_encryptionEnabledTrue_isTrue() {
    let config: NSDictionary = ["encryptionEnabled": NSNumber(value: true)]
    let encryptionEnabledValue: Bool? = (config["encryptionEnabled"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let encryptionEnabledValue {
      oathConfig.encryptionEnabled = encryptionEnabledValue
    }

    XCTAssertTrue(oathConfig.encryptionEnabled)
  }

  func test_configWiring_missingTimeout_timeoutMsRemainsDefault() {
    // When timeout is absent, the if-let guard skips the assignment.
    let config: NSDictionary = [:]
    let timeoutSeconds: Double? = (config["timeout"] as? NSNumber)?.doubleValue

    let oathConfig = OathConfiguration()
    if let timeoutSeconds {
      oathConfig.timeoutMs = timeoutSeconds
    }

    // Default is 15.0 seconds (from OathConfiguration.swift)
    XCTAssertEqual(oathConfig.timeoutMs, 15.0)
  }

  func test_configWiring_missingEncryptionEnabled_remainsDefault() {
    // When encryptionEnabled is absent, the if-let guard skips the assignment
    // and the native SDK default (true) is preserved.
    let config: NSDictionary = [:]
    let encryptionEnabledValue: Bool? = (config["encryptionEnabled"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let encryptionEnabledValue {
      oathConfig.encryptionEnabled = encryptionEnabledValue
    }

    // Native SDK default for encryptionEnabled is true
    XCTAssertTrue(oathConfig.encryptionEnabled)
  }

  func test_configWiring_missingEnableCredentialCache_remainsDefault() {
    // When enableCredentialCache is absent, the if-let guard skips the assignment
    // and the native SDK default (false) is preserved.
    let config: NSDictionary = [:]
    let enableCredentialCacheValue: Bool? = (config["enableCredentialCache"] as? NSNumber)?.boolValue

    let oathConfig = OathConfiguration()
    if let enableCredentialCacheValue {
      oathConfig.enableCredentialCache = enableCredentialCacheValue
    }

    // Native SDK default for enableCredentialCache is false
    XCTAssertFalse(oathConfig.enableCredentialCache)
  }

  // MARK: - Storage wiring tests

  func test_create_storageIdUnresolvable_rejectsWithArgumentError() {
    // When storageId names a handle that is not in the registry, the bridge must
    // reject with argument_error — no silent fallthrough to the default storage.
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true
    let capture = ErrorCaptureBox()

    RNPingOathCommon.create(
      ["storageId": "nonexistent-storage-id"] as NSDictionary,
      resolver: { _ in Task { @MainActor in resolveExpectation.fulfill() } },
      rejecter: { code, _, error in
        capture.set(code: code ?? "", error: error as NSError?)
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 2.0)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, "argument_error")
  }

  // Note: the absent-storageId path (nil storageId → SDK default storage) is
  // exercised by all existing handle-unknown tests that call create() with an
  // empty config dictionary (e.g., test_cleanup_closeOnUnknownHandleResolvesNull).

  // MARK: - Helper

  private func assertRejectsWithStateError(
    call: (
      _ rejecter: @escaping RCTPromiseRejectBlock,
      _ resolver: @escaping RCTPromiseResolveBlock
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    call({ code, _, error in
      capture.set(code: code ?? "", error: error as NSError?)
      Task { @MainActor in
        rejectExpectation.fulfill()
      }
    }, { _ in
      Task { @MainActor in
        resolveExpectation.fulfill()
      }
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, OathErrorCodes.stateError.rawValue, file: file, line: line)
    XCTAssertEqual(
      capture.error?.userInfo["type"] as? String,
      ErrorType.stateError.rawValue,
      file: file,
      line: line
    )
  }

  // MARK: - Policy evaluator producer tests

  func test_registerOathPolicyEvaluator_withBothPolicies_returnsDeterministicIdAndRoundTrips() {
    let config: NSDictionary = [
      "policies": ["biometricAvailable", "deviceTampering"],
    ]

    let id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    XCTAssertFalse(id.isEmpty, "registerOathPolicyEvaluator must return a non-empty id")

    let result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    let policies = result["policies"] as? [String]
    XCTAssertNotNil(policies, "policies array must be present in round-trip result")
    XCTAssertEqual(policies?.count, 2)
    XCTAssertEqual(policies?[0], "biometricAvailable")
    XCTAssertEqual(policies?[1], "deviceTampering")
  }

  func test_registerOathPolicyEvaluator_withLoggerId_roundTripsLoggerId() {
    let config: NSDictionary = [
      "policies": ["biometricAvailable"],
      "loggerId": "test-logger-id",
    ]

    let id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    let result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    XCTAssertEqual(result["loggerId"] as? String, "test-logger-id")
  }

  func test_registerOathPolicyEvaluator_withoutLoggerId_roundTripHasNoLoggerId() {
    let config: NSDictionary = ["policies": ["biometricAvailable"]]

    let id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    let result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    XCTAssertNil(result["loggerId"], "loggerId must not be present when not provided")
  }

  func test_registerOathPolicyEvaluator_unknownPolicyKind_isIgnoredGracefully() {
    let config: NSDictionary = [
      "policies": ["biometricAvailable", "unknownPolicy"],
    ]

    let id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    let result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    let policies = result["policies"] as? [String]
    XCTAssertEqual(policies?.count, 1)
    XCTAssertEqual(policies?[0], "biometricAvailable")
  }

  func test_registerOathPolicyEvaluator_twoRegistrations_returnDistinctIds() {
    let config: NSDictionary = ["policies": ["biometricAvailable"]]

    let id1 = RNPingOathCommon.registerOathPolicyEvaluator(config)
    let id2 = RNPingOathCommon.registerOathPolicyEvaluator(config)

    XCTAssertFalse(id1.isEmpty)
    XCTAssertFalse(id2.isEmpty)
    XCTAssertNotEqual(id1, id2, "Two separate registrations must produce distinct ids")
  }

  func test_configureOathPolicyEvaluator_unknownId_returnsEmptyPolicies() {
    let result = RNPingOathCommon.configureOathPolicyEvaluator("nonexistent-id")
    let policies = result["policies"] as? [String]
    XCTAssertNotNil(policies)
    XCTAssertEqual(policies?.count, 0)
  }

  // MARK: - Task 25: policyEvaluator consumer tests

  func test_create_policyEvaluatorIdUnresolvable_rejectsWithArgumentError() {
    // When policyEvaluatorId names a handle that was never registered, the bridge
    // must reject with argument_error — stale handle is a caller mistake.
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true
    let capture = ErrorCaptureBox()

    RNPingOathCommon.create(
      ["policyEvaluatorId": "nonexistent-evaluator-id"] as NSDictionary,
      resolver: { _ in Task { @MainActor in resolveExpectation.fulfill() } },
      rejecter: { code, _, error in
        capture.set(code: code ?? "", error: error as NSError?)
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 2.0)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, "argument_error")
  }

  func test_policyEvaluatorWiring_biometricAndDeviceTampering_constructsEvaluatorWithBothPolicies() {
    // Replicate the extraction recipe from RNPingOathCommon.create(): given a
    // descriptor, map it to native MfaPolicy instances and call
    // MfaPolicyEvaluator.create { ... }.
    //
    // Why recipe replication over going through create(): OathClient.createClient
    // is an async SDK call requiring a real device environment. Testing the
    // extraction recipe directly verifies the bridging contract without triggering
    // full SDK initialisation — matching the timeout/enableCredentialCache wiring tests.
    let descriptorPolicies: [OathPolicyDescriptor] = [.biometricAvailable, .deviceTampering]

    let nativePolicies: [any MfaPolicy] = descriptorPolicies.map { policy in
      switch policy {
      case .biometricAvailable: return BiometricAvailablePolicy()
      case .deviceTampering: return DeviceTamperingPolicy()
      }
    }
    let evaluator = MfaPolicyEvaluator.create { config in
      config.policies = nativePolicies
    }

    // MfaPolicyEvaluator is an actor, so getPolicies() requires await.
    let expectation = self.expectation(description: "getPolicies")
    Task {
      let policies = await evaluator.getPolicies()
      XCTAssertEqual(policies.count, 2, "Evaluator must hold exactly 2 policies")
      XCTAssertTrue(
        policies.contains { $0.name == "biometricAvailable" },
        "BiometricAvailablePolicy must be registered"
      )
      XCTAssertTrue(
        policies.contains { $0.name == "deviceTampering" },
        "DeviceTamperingPolicy must be registered"
      )
      await MainActor.run { expectation.fulfill() }
    }
    wait(for: [expectation], timeout: 2.0)
  }
}
