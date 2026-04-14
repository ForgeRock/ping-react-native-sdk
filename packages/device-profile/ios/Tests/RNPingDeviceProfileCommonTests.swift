//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.

import XCTest
import RNPingCore
import RNPingDeviceProfile

/// XCTest coverage for the shared iOS device profile bridge logic.
final class RNPingDeviceProfileCommonTests: XCTestCase {

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

    wait(for: [expectation], timeout: 2)
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

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileWithAllStableKnownCollectors() {
    let expectation = expectation(description: "resolver called")

    // Bluetooth and Location are intentionally excluded because CoreBluetooth can remain in
    // a transient state on simulators long enough to make this unit test
    // non-deterministic in CI.
    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "hardware", "network", "telephony", "browser"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNotNil(payload["hardware"])
        XCTAssertNotNil(payload["network"])
        XCTAssertNotNil(payload["telephony"])
        XCTAssertNotNil(payload["browser"])
        XCTAssertNil(payload["bluetooth"])
        XCTAssertNil(payload["location"])
        XCTAssertEqual(payload.count, 5)
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 2)
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
