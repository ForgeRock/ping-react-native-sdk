/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore


final class SimpleRegistryTests: XCTestCase {

  private final class FakeHandle: NativeHandle {}

  func testRegisterAndResolveReturnsSameInstance() async throws {
    let registry = SimpleRegistry()
    let handle = FakeHandle()

    let id = await registry.register(handle)
    let resolved = await registry.resolve(id) as? FakeHandle

    XCTAssertNotNil(resolved)
    XCTAssertTrue(resolved === handle)
  }

  func testRegisterProducesDistinctIds() async throws {
    let registry = SimpleRegistry()
    let id1 = await registry.register(FakeHandle())
    let id2 = await registry.register(FakeHandle())

    XCTAssertNotEqual(id1, id2)
  }

  func testRemoveDropsHandle() async throws {
    let registry = SimpleRegistry()
    let id = await registry.register(FakeHandle())

    await registry.remove(id)

    let resolved = await registry.resolve(id)
    XCTAssertNil(resolved)
  }

  func testRemoveAllClearsRegistry() async throws {
    let registry = SimpleRegistry()
    let id1 = await registry.register(FakeHandle())
    let id2 = await registry.register(FakeHandle())

    await registry.removeAll()

    let resolved1 = await registry.resolve(id1)
    let resolved2 = await registry.resolve(id2)
    XCTAssertNil(resolved1)
    XCTAssertNil(resolved2)
  }
}
