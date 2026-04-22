/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.device.client.BoundDevice
import com.pingidentity.device.client.Device
import com.pingidentity.device.client.Location
import com.pingidentity.device.client.OathDevice
import com.pingidentity.device.client.ProfileDevice
import com.pingidentity.device.client.PushDevice
import com.pingidentity.device.client.WebAuthnDevice
import com.pingidentity.rncore.utils.JsonBridgeMapper
import com.pingidentity.rncore.utils.requireString

/**
 * Bridges React Native `ReadableMap`/`WritableMap` payloads and the native
 * Device Client Kotlin data classes.
 *
 * The JS contract keeps friendly names (`id`, `deviceName`) while the native
 * classes use server-aligned field names (`_id`, `alias`). All mapping is
 * centralized here.
 */
internal object DeviceJson {

  // region  JS -> Kotlin

  /**
   * Decode a JS device payload into the matching Kotlin [Device] type.
   *
   * The [kind] string determines which concrete [Device] subclass is instantiated.
   * Required fields are validated via [requireString] and [requireLong]; missing
   * values throw [IllegalArgumentException].
   *
   * @param kind One of `oath`, `push`, `bound`, `profile`, or `webAuthn`.
   * @param map React Native [ReadableMap] containing the JS device payload.
   * @return A concrete [Device] subclass matching the given [kind].
   * @throws IllegalArgumentException If [kind] is unsupported or a required field is missing.
   */
  fun decodeDevice(kind: String, map: ReadableMap): Device {
    val id = requireString(map, "id")
    val deviceName = requireString(map, "deviceName")
    return when (kind) {
      "oath" -> OathDevice(
        id = id,
        deviceName = deviceName,
        uuid = requireString(map, "uuid"),
        createdDate = requireLong(map, "createdDate"),
        lastAccessDate = requireLong(map, "lastAccessDate"),
      )
      "push" -> PushDevice(
        id = id,
        deviceName = deviceName,
        uuid = requireString(map, "uuid"),
        createdDate = requireLong(map, "createdDate"),
        lastAccessDate = requireLong(map, "lastAccessDate"),
      )
      "bound" -> BoundDevice(
        id = id,
        deviceName = deviceName,
        deviceId = requireString(map, "deviceId"),
        uuid = requireString(map, "uuid"),
        createdDate = requireLong(map, "createdDate"),
        lastAccessDate = requireLong(map, "lastAccessDate"),
      )
      "webAuthn" -> WebAuthnDevice(
        id = id,
        deviceName = deviceName,
        uuid = requireString(map, "uuid"),
        credentialId = requireString(map, "credentialId"),
        createdDate = requireLong(map, "createdDate"),
        lastAccessDate = requireLong(map, "lastAccessDate"),
      )
      "profile" -> ProfileDevice(
        id = id,
        deviceName = deviceName,
        identifier = requireString(map, "identifier"),
        metadata = map.getMap("metadata")?.let { JsonBridgeMapper.decodeReadableMap(it) } ?: kotlinx.serialization.json.JsonObject(emptyMap()),
        location = map.getMap("location")?.let {
          Location(
            latitude = if (it.hasKey("latitude")) it.getDouble("latitude") else null,
            longitude = if (it.hasKey("longitude")) it.getDouble("longitude") else null,
          )
        },
        lastSelectedDate = requireLong(map, "lastSelectedDate"),
      )
      else -> throw IllegalArgumentException("Unsupported device kind: $kind")
    }
  }

  // endregion

  // region  Kotlin -> JS

  /**
   * Encode a native [Device] into a React Native [WritableMap] suitable for
   * resolving a JS promise.
   *
   * Each concrete device type is mapped to its JS-friendly field names
   * (e.g. `_id` -> `id`, `alias` -> `deviceName`).
   *
   * @param device The native [Device] instance to encode.
   * @return A [WritableMap] containing the JS-friendly device representation.
   */
  fun encodeDevice(device: Device): WritableMap {
    val map = Arguments.createMap()
    when (device) {
      is OathDevice -> writeCommon(map, device.id, device.deviceName, device.uuid, device.createdDate, device.lastAccessDate)
      is PushDevice -> writeCommon(map, device.id, device.deviceName, device.uuid, device.createdDate, device.lastAccessDate)
      is BoundDevice -> {
        writeCommon(map, device.id, device.deviceName, device.uuid, device.createdDate, device.lastAccessDate)
        map.putString("deviceId", device.deviceId)
      }
      is WebAuthnDevice -> {
        writeCommon(map, device.id, device.deviceName, device.uuid, device.createdDate, device.lastAccessDate)
        map.putString("credentialId", device.credentialId)
      }
      is ProfileDevice -> {
        map.putString("id", device.id)
        map.putString("deviceName", device.deviceName)
        map.putString("identifier", device.identifier)
        map.putMap("metadata", JsonBridgeMapper.encodeJsonObject(device.metadata) as WritableMap)
        map.putDouble("lastSelectedDate", device.lastSelectedDate.toDouble())
        device.location?.let {
          val loc = Arguments.createMap()
          it.latitude?.let { lat -> loc.putDouble("latitude", lat) }
          it.longitude?.let { lon -> loc.putDouble("longitude", lon) }
          map.putMap("location", loc)
        } ?: map.putNull("location")
      }
    }
    return map
  }

  /**
   * Encode a list of native [Device] instances into a React Native [WritableArray].
   *
   * @param devices The list of [Device] instances to encode.
   * @return A [WritableArray] where each element is an encoded [WritableMap].
   */
  fun encodeDevices(devices: List<Device>): WritableArray {
    val array = Arguments.createArray()
    devices.forEach { array.pushMap(encodeDevice(it)) }
    return array
  }

  // endregion

  // region  helpers

  /**
   * Write the common fields shared by [OathDevice], [PushDevice], [BoundDevice],
   * and [WebAuthnDevice] into a [WritableMap].
   *
   * @param map Target writable map to populate.
   * @param id Device identifier.
   * @param deviceName Human-readable device name.
   * @param uuid Device UUID.
   * @param createdDate Epoch timestamp when the device was created.
   * @param lastAccessDate Epoch timestamp of the last access.
   */
  private fun writeCommon(
    map: WritableMap,
    id: String,
    deviceName: String,
    uuid: String,
    createdDate: Long,
    lastAccessDate: Long,
  ) {
    map.putString("id", id)
    map.putString("deviceName", deviceName)
    map.putString("uuid", uuid)
    map.putDouble("createdDate", createdDate.toDouble())
    map.putDouble("lastAccessDate", lastAccessDate.toDouble())
  }

  /**
   * Extract a required numeric value from a [ReadableMap] and convert it to [Long].
   *
   * React Native bridge transmits all numbers as doubles, so we read with
   * [ReadableMap.getDouble] and truncate to [Long].
   *
   * @param map Source readable map.
   * @param key The field name to read.
   * @return The numeric value as a [Long].
   * @throws IllegalArgumentException If the key is missing or the value is null.
   */
  private fun requireLong(map: ReadableMap, key: String): Long {
    require(map.hasKey(key) && !map.isNull(key)) { "Missing required numeric field: $key" }
    return map.getDouble(key).toLong()
  }

  // endregion
}
