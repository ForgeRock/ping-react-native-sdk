/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.pingidentity.device.client.BoundDevice
import com.pingidentity.device.client.Location
import com.pingidentity.device.client.OathDevice
import com.pingidentity.device.client.ProfileDevice
import com.pingidentity.device.client.PushDevice
import com.pingidentity.device.client.WebAuthnDevice
import io.mockk.every
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for [DeviceJson] — the field-by-field mapping between the
 * native Kotlin [com.pingidentity.device.client.Device] models and the
 * React Native `ReadableMap` / `WritableMap` payloads.
 *
 * Because the native models use server-aligned names (`_id`, `alias`),
 * drift between the mapping and the JS contract is easy to miss. These
 * tests lock down the field-level contract per device kind.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class DeviceJsonTest {

  @Before
  fun setUp() {
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
  }

  @After
  fun tearDown() {
    unmockkStatic(Arguments::class)
  }

  // region  encodeDevice

  @Test
  fun `encodeDevice writes common OathDevice fields`() {
    val device = OathDevice(
      id = "id-1",
      deviceName = "iPhone",
      uuid = "uuid-1",
      createdDate = 1_700_000_000_000L,
      lastAccessDate = 1_700_000_100_000L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertEquals("id-1", map.getString("id"))
    assertEquals("iPhone", map.getString("deviceName"))
    assertEquals("uuid-1", map.getString("uuid"))
    assertEquals(1_700_000_000_000.0, map.getDouble("createdDate"), 0.0)
    assertEquals(1_700_000_100_000.0, map.getDouble("lastAccessDate"), 0.0)
  }

  @Test
  fun `encodeDevice writes common PushDevice fields`() {
    val device = PushDevice(
      id = "id-2",
      deviceName = "Pixel",
      uuid = "uuid-2",
      createdDate = 1L,
      lastAccessDate = 2L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertEquals("id-2", map.getString("id"))
    assertEquals("Pixel", map.getString("deviceName"))
    assertEquals("uuid-2", map.getString("uuid"))
  }

  @Test
  fun `encodeDevice writes deviceId for BoundDevice`() {
    val device = BoundDevice(
      id = "id-3",
      deviceName = "Laptop",
      deviceId = "bound-device-123",
      uuid = "uuid-3",
      createdDate = 10L,
      lastAccessDate = 20L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertEquals("id-3", map.getString("id"))
    assertEquals("bound-device-123", map.getString("deviceId"))
  }

  @Test
  fun `encodeDevice writes credentialId for WebAuthnDevice`() {
    val device = WebAuthnDevice(
      id = "id-4",
      deviceName = "YubiKey",
      uuid = "uuid-4",
      credentialId = "cred-abc",
      createdDate = 10L,
      lastAccessDate = 20L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertEquals("id-4", map.getString("id"))
    assertEquals("cred-abc", map.getString("credentialId"))
  }

  @Test
  fun `encodeDevice writes ProfileDevice with location`() {
    val device = ProfileDevice(
      id = "id-5",
      deviceName = "Samsung",
      identifier = "ident-xyz",
      metadata = JsonObject(mapOf("k" to JsonPrimitive("v"))),
      location = Location(latitude = 12.34, longitude = 56.78),
      lastSelectedDate = 1_700_000_000_000L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertEquals("id-5", map.getString("id"))
    assertEquals("Samsung", map.getString("deviceName"))
    assertEquals("ident-xyz", map.getString("identifier"))
    assertEquals(1_700_000_000_000.0, map.getDouble("lastSelectedDate"), 0.0)

    val loc = map.getMap("location")!!
    assertEquals(12.34, loc.getDouble("latitude"), 0.0)
    assertEquals(56.78, loc.getDouble("longitude"), 0.0)
  }

  @Test
  fun `encodeDevice writes null location when ProfileDevice lacks one`() {
    val device = ProfileDevice(
      id = "id-6",
      deviceName = "Tablet",
      identifier = "ident",
      metadata = JsonObject(emptyMap()),
      location = null,
      lastSelectedDate = 5L,
    )
    val map = DeviceJson.encodeDevice(device)

    assertTrue(map.isNull("location"))
  }

  @Test
  fun `encodeDevices pushes one map per device`() {
    val array = DeviceJson.encodeDevices(
      listOf(
        OathDevice("a", "one", "u1", 1L, 2L),
        PushDevice("b", "two", "u2", 3L, 4L),
      ),
    )
    assertEquals(2, array.size())
    assertEquals("a", array.getMap(0)!!.getString("id"))
    assertEquals("b", array.getMap(1)!!.getString("id"))
  }

  // endregion

  // region  decodeDevice

  @Test
  fun `decodeDevice builds an OathDevice`() {
    val map = JavaOnlyMap().apply {
      putString("id", "id-1")
      putString("deviceName", "iPhone")
      putString("uuid", "uuid-1")
      putDouble("createdDate", 1_700_000_000_000.0)
      putDouble("lastAccessDate", 1_700_000_100_000.0)
    }
    val device = DeviceJson.decodeDevice("oath", map) as OathDevice
    assertEquals("id-1", device.id)
    assertEquals("iPhone", device.deviceName)
    assertEquals("uuid-1", device.uuid)
    assertEquals(1_700_000_000_000L, device.createdDate)
    assertEquals(1_700_000_100_000L, device.lastAccessDate)
  }

  @Test
  fun `decodeDevice builds a BoundDevice`() {
    val map = JavaOnlyMap().apply {
      putString("id", "id-3")
      putString("deviceName", "Laptop")
      putString("deviceId", "bound-device-123")
      putString("uuid", "uuid-3")
      putDouble("createdDate", 10.0)
      putDouble("lastAccessDate", 20.0)
    }
    val device = DeviceJson.decodeDevice("bound", map) as BoundDevice
    assertEquals("bound-device-123", device.deviceId)
  }

  @Test
  fun `decodeDevice builds a WebAuthnDevice`() {
    val map = JavaOnlyMap().apply {
      putString("id", "id-4")
      putString("deviceName", "YubiKey")
      putString("uuid", "uuid-4")
      putString("credentialId", "cred-abc")
      putDouble("createdDate", 1.0)
      putDouble("lastAccessDate", 2.0)
    }
    val device = DeviceJson.decodeDevice("webAuthn", map) as WebAuthnDevice
    assertEquals("cred-abc", device.credentialId)
  }

  @Test
  fun `decodeDevice builds a ProfileDevice with null location`() {
    val map = JavaOnlyMap().apply {
      putString("id", "id-5")
      putString("deviceName", "Samsung")
      putString("identifier", "ident-xyz")
      putDouble("lastSelectedDate", 5.0)
    }
    val device = DeviceJson.decodeDevice("profile", map) as ProfileDevice
    assertEquals("ident-xyz", device.identifier)
    assertNull(device.location)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `decodeDevice throws on unknown kind`() {
    val map = JavaOnlyMap().apply {
      putString("id", "x")
      putString("deviceName", "y")
    }
    DeviceJson.decodeDevice("fingerprint", map)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `decodeDevice throws when required field is missing`() {
    val map = JavaOnlyMap().apply {
      putString("id", "id-1")
      putString("deviceName", "iPhone")
      // uuid intentionally absent
      putDouble("createdDate", 1.0)
      putDouble("lastAccessDate", 2.0)
    }
    DeviceJson.decodeDevice("oath", map)
  }

  // endregion
}
