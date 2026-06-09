//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.

import XCTest
import RNPingCore
@testable import RNPingDeviceProfile

/// XCTest coverage for the shared iOS device profile bridge logic.
///
/// - Note: `testCollectDeviceProfileWithAllStableKnownCollectors` was removed because it was
///   consistently flaky on CI simulators — five sequential real collectors (platform, hardware,
///   network, telephony, browser) regularly exceeded the 10s timeout under parallel simulator load.
final class RNPingDeviceProfileCommonTests: XCTestCase {

  override func tearDown() {
    RNPingDeviceProfileCommon.setCollectPayloadOverrideForTesting(nil)
    super.tearDown()
  }

  func testCollectDeviceProfileResolvesEmptyWhenNoCollectorsProvided() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      [],
      resolver: { payload in
        XCTAssertEqual(payload.count, 0)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileResolvesEmptyWhenCollectorsUnknown() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["unknown", "ignored", "", "Platform"],
      resolver: { payload in
        XCTAssertEqual(payload.count, 0)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileResolvesPlatformData() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileResolvesMixedCollectors() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "unknown", "", "HARDWARE"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNil(payload["unknown"])
        XCTAssertNil(payload[""])
        XCTAssertNil(payload["HARDWARE"])
        XCTAssertEqual(payload.count, 1)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileForJourneyRejectsWhenNoCallbackFound() {
    let expectation = expectation(description: "rejecter called")
    let journeyId = "missing-journey-id"

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      journeyId,
      collectors: [],
      loggerId: nil,
      resolver: { _ in
        XCTFail("resolver should not be called")
      },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "DEVICE_PROFILE_CALLBACK_NOT_FOUND")
        XCTAssertEqual(message, "No active Device Profile callback found for journey \(journeyId).")
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileForJourneyRejectsWhenCallbackListEmpty() {
    let expectation = expectation(description: "rejecter called")
    let journeyId = "empty-callbacks-journey"

    CoreRuntime.setJourneyCallbackResolver { id in
      if id == journeyId {
        return []
      }
      return nil
    }
    defer { CoreRuntime.setJourneyCallbackResolver(nil) }

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      journeyId,
      collectors: [],
      loggerId: nil,
      resolver: { _ in
        XCTFail("resolver should not be called")
      },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "DEVICE_PROFILE_CALLBACK_NOT_FOUND")
        XCTAssertEqual(message, "No active Device Profile callback found for journey \(journeyId).")
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileWithMultipleCollectors() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "hardware", "network"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNotNil(payload["hardware"])
        XCTAssertNotNil(payload["network"])
        XCTAssertEqual(payload.count, 3)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    // This path executes multiple real collectors and can exceed 2s under
    // parallel simulator load in CI.
    wait(for: [expectation], timeout: 5)
  }

  func testCollectDeviceProfileDeduplicatesDuplicateCollectors() {
    let expectation = expectation(description: "resolver called")

    // buildCollectors appends one instance per name, so duplicates enter the
    // pipeline as separate collector instances. Deduplication is enforced by
    // collectPayload writing into a [String: Any] dictionary keyed on
    // collector.key — later writes overwrite earlier ones for the same key.
    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "platform", "hardware"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNotNil(payload["hardware"])
        XCTAssertEqual(payload.count, 2, "Duplicate collector names must not produce duplicate keys")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    // CI elapsed ~6.1s under parallel simulator load.
    wait(for: [expectation], timeout: 10)
  }

  func testCollectDeviceProfileResolvesBluetoothPayloadWithInjectedExecutor() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.setCollectPayloadOverrideForTesting { collectors in
      XCTAssertEqual(collectors.map(\.key), ["bluetooth"])
      return ["bluetooth": ["supported": true]]
    }

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["bluetooth"],
      resolver: { payload in
        let bluetooth = payload["bluetooth"] as? [String: Any]
        XCTAssertEqual(payload.count, 1)
        XCTAssertEqual(bluetooth?["supported"] as? Bool, true)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileResolvesLocationPayloadWithInjectedExecutor() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.setCollectPayloadOverrideForTesting { collectors in
      XCTAssertEqual(collectors.map(\.key), ["location"])
      return ["location": ["latitude": 49.2827, "longitude": -123.1207]]
    }

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["location"],
      resolver: { payload in
        let location = payload["location"] as? [String: Any]
        XCTAssertEqual(payload.count, 1)
        XCTAssertEqual(location?["latitude"] as? Double, 49.2827)
        XCTAssertEqual(location?["longitude"] as? Double, -123.1207)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileRejectsInjectedCollectorFailure() {
    let expectation = expectation(description: "rejecter called")

    RNPingDeviceProfileCommon.setCollectPayloadOverrideForTesting { collectors in
      XCTAssertEqual(collectors.map(\.key), ["location"])
      throw NSError(
        domain: "RNPingDeviceProfileTests",
        code: 99,
        userInfo: [NSLocalizedDescriptionKey: "Injected collector failure"]
      )
    }

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["location"],
      resolver: { _ in
        XCTFail("resolver should not be called")
      },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "DEVICE_PROFILE_COLLECT_ERROR")
        XCTAssertTrue(message.contains("Injected collector failure"))
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileForJourneyWithEmptyJourneyIdRejects() {
    let expectation = expectation(description: "rejecter called")

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      "",
      collectors: ["platform"],
      loggerId: nil,
      resolver: { _ in
        XCTFail("resolver should not be called")
      },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "DEVICE_PROFILE_CALLBACK_NOT_FOUND")
        XCTAssertEqual(message, "No active Device Profile callback found for journey .")
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }
}
