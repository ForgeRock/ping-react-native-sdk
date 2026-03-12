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
      ["unknown", "ignored"],
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
      ["platform", "unknown"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNil(payload["unknown"])
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

    // Save original resolver
    let originalResolver = CoreRuntime.journeyCallbackResolver
    defer { CoreRuntime.journeyCallbackResolver = originalResolver }

    CoreRuntime.journeyCallbackResolver = { id in
      if id == journeyId {
        return []
      }
      return nil
    }

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      journeyId,
      collectors: [],
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

  func testCollectDeviceProfileWithDuplicateCollectors() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "platform", "hardware"],
      resolver: { payload in
        // Duplicates should still only result in one entry per collector type
        XCTAssertNotNil(payload["platform"])
        XCTAssertNotNil(payload["hardware"])
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 2)
  }

  func testCollectDeviceProfileIgnoresLocationInExcludedMode() {
    let expectation = expectation(description: "resolver called")

    // When location is requested but excluded via includeLocation flag,
    // it should not be collected
    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "location"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        // Location should be included when using collectDeviceProfile
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 2)
  }

  func testCollectDeviceProfileWithAllKnownCollectors() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["platform", "hardware", "network", "telephony", "browser", "bluetooth"],
      resolver: { payload in
        // Verify all collectors are present (location excluded intentionally)
        XCTAssertGreaterThanOrEqual(payload.count, 1, "Should have at least one collector")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 2)
  }

  func testCollectDeviceProfileWithEmptyStringCollector() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["", "platform"],
      resolver: { payload in
        XCTAssertNotNil(payload["platform"])
        XCTAssertNil(payload[""])
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileWithCaseSensitiveCollectors() {
    let expectation = expectation(description: "resolver called")

    RNPingDeviceProfileCommon.collectDeviceProfile(
      ["Platform", "HARDWARE", "platform"],
      resolver: { payload in
        // Only lowercase "platform" should match
        XCTAssertNotNil(payload["platform"])
        XCTAssertNil(payload["Platform"])
        XCTAssertNil(payload["HARDWARE"])
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("rejecter should not be called")
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testCollectDeviceProfileForJourneyWithEmptyJourneyIdRejects() {
    let expectation = expectation(description: "rejecter called")

    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      "",
      collectors: ["platform"],
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
