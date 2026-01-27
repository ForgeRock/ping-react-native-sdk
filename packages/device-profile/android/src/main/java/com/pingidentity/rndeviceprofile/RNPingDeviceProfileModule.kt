/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.device.profile.DeviceProfileCallback
import com.pingidentity.device.profile.collector.BluetoothCollector
import com.pingidentity.device.profile.collector.BrowserCollector
import com.pingidentity.device.profile.collector.DeviceCollector
import com.pingidentity.device.profile.collector.HardwareCollector
import com.pingidentity.device.profile.collector.LocationCollector
import com.pingidentity.device.profile.collector.NetworkCollector
import com.pingidentity.device.profile.collector.PlatformCollector
import com.pingidentity.device.profile.collector.TelephonyCollector
import com.pingidentity.device.profile.collector.collect
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * React Native module for collecting device profile information.
 *
 * This module provides functionality to collect device profile data both independently
 * and as part of Journey authentication flows. It supports various collectors for
 * platform, hardware, network, telephony, browser, bluetooth, and location data.
 *
 * @param reactContext The React Native application context.
 */
class RNPingDeviceProfileModule(reactContext: ReactApplicationContext) :
  NativeRNPingDeviceProfileSpec(reactContext) {
  private val scope = CoroutineScope(Dispatchers.IO)

  /**
   * Collects device profile information outside of Journey flows.
   *
   * This method gathers device profile data based on the specified collectors and returns
   * the result as a JSON object. The collection includes location data if the location
   * collector is specified.
   *
   * @param collectorNames Array of collector names to use (e.g., "platform", "hardware", "network").
   * @param promise React Native promise that resolves with the collected device profile data or rejects with an error.
   */
  override fun collectDeviceProfile(collectorNames: ReadableArray, promise: Promise) {
    val collectorTypes = readCollectors(collectorNames)
    val deviceCollectors = buildCollectors(collectorTypes, includeLocation = true)

    scope.launch {
      try {
        val jsonElement = if (deviceCollectors.isEmpty()) {
          JsonObject(emptyMap())
        } else {
          deviceCollectors.collect()
        }
        promise.resolve(jsonElement.toReactValue())
      } catch (e: Exception) {
        promise.reject("DEVICE_PROFILE_COLLECT_ERROR", "Failed to collect device profile: ${e.message}", e)
      }
    }
  }

  /**
   * Collects device profile information as part of a Journey authentication flow.
   *
   * This method gathers device profile data specifically for Journey callbacks, using the
   * DeviceProfileCollector with appropriate configuration. Location data is collected separately
   * from metadata when the location collector is specified.
   *
   * @param journeyId The unique identifier for the Journey flow.
   * @param collectorNames Array of collector names to use for profile collection.
   * @param promise React Native promise that resolves with the collected device profile result or rejects with an error.
   */
  override fun collectDeviceProfileForJourney(
    journeyId: String,
    collectorNames: ReadableArray,
    callbackPayload: ReadableMap?,
    promise: Promise
  ) {
    val collectorTypes = readCollectors(collectorNames)
    val metadataCollectors = buildCollectors(collectorTypes, includeLocation = false)
    val includeLocation = collectorTypes.contains("location")

    scope.launch {
      try {
        val payload = callbackPayload?.toJsonObject()
          ?: buildCallbackPayload(
            metadataEnabled = metadataCollectors.isNotEmpty(),
            locationEnabled = includeLocation,
            message = ""
          )

        val callback = DeviceProfileCallback().apply {
          init(payload)
        }

        val result = callback.collect {
          collectors {
            clear()
            addAll(metadataCollectors)
          }
        }

        result.fold(
          onSuccess = { profile -> promise.resolve(profile.toReactValue()) },
          onFailure = { error ->
            promise.reject(
              "DEVICE_PROFILE_COLLECT_ERROR",
              "Failed to collect device profile for journey $journeyId: ${error.message}",
              error
            )
          }
        )
      } catch (e: Exception) {
        promise.reject(
          "DEVICE_PROFILE_COLLECT_ERROR",
          "Failed to collect device profile for journey $journeyId: ${e.message}",
          e
        )
      }
    }
  }

  companion object {
    const val NAME = NativeRNPingDeviceProfileSpec.NAME
  }

  /**
   * Parses a ReadableArray of collector names into a list of strings.
   *
   * @param collectors The ReadableArray containing collector names.
   * @return List of collector name strings.
   */
  private fun readCollectors(collectors: ReadableArray): List<String> {
    val collectorsList = ArrayList<String>(collectors.size())
    for (index in 0 until collectors.size()) {
      if (collectors.getType(index) == ReadableType.String) {
        collectors.getString(index)?.let { collectorsList.add(it) }
      }
    }
    return collectorsList
  }

  /**
   * Constructs a list of DeviceCollector instances based on the specified collector types.
   *
   * @param collectorTypes List of collector type names to instantiate.
   * @param includeLocation Whether to include the LocationCollector when "location" is specified.
   * @return Mutable list of DeviceCollector instances.
   */
  private fun buildCollectors(
    collectorTypes: List<String>,
    includeLocation: Boolean
  ): MutableList<DeviceCollector<*>> {
    val collectors = mutableListOf<DeviceCollector<*>>()
    collectorTypes.forEach { collector ->
      when (collector) {
        "platform" -> collectors.add(PlatformCollector())
        "hardware" -> collectors.add(HardwareCollector())
        "network" -> collectors.add(NetworkCollector())
        "telephony" -> collectors.add(TelephonyCollector)
        "browser" -> collectors.add(BrowserCollector)
        "bluetooth" -> collectors.add(BluetoothCollector)
        "location" -> if (includeLocation) {
          collectors.add(LocationCollector())
        }
      }
    }
    return collectors
  }

  /**
   * Builds a callback payload compatible with AbstractCallback.init() for DeviceProfileCallback.
   *
   * @param metadataEnabled Whether metadata collection is enabled.
   * @param locationEnabled Whether location collection is enabled.
   * @param message Optional message to include with the callback.
   * @return JsonObject containing callback output items.
   */
  private fun buildCallbackPayload(
    metadataEnabled: Boolean,
    locationEnabled: Boolean,
    message: String
  ): JsonObject {
    val outputItems = listOf(
      JsonObject(
        mapOf(
          "name" to JsonPrimitive("metadata"),
          "value" to JsonPrimitive(metadataEnabled)
        )
      ),
      JsonObject(
        mapOf(
          "name" to JsonPrimitive("location"),
          "value" to JsonPrimitive(locationEnabled)
        )
      ),
      JsonObject(
        mapOf(
          "name" to JsonPrimitive("message"),
          "value" to JsonPrimitive(message)
        )
      )
    )

    return JsonObject(mapOf("output" to JsonArray(outputItems)))
  }

  /**
   * Converts a JsonElement into a React Native bridge-compatible value.
   *
   * Recursively converts JSON structures into WritableMap, WritableArray, or primitive values
   * that can be passed through the React Native bridge.
   *
   * @return The converted value suitable for the React Native bridge, or null for JsonNull.
   */
  internal fun JsonElement.toReactValue(): Any? = when (this) {
    is JsonObject -> toWritableMap()
    is JsonArray -> toWritableArray()
    is JsonPrimitive -> toPrimitiveValue()
    is JsonNull -> null
    else -> toString()
  }

  /**
   * Converts a JsonObject into a WritableMap for React Native.
   *
   * Recursively processes all key-value pairs, converting nested objects and arrays
   * into their corresponding WritableMap and WritableArray types.
   *
   * @return A WritableMap containing the converted JSON object data.
   */
  internal fun JsonObject.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    forEach { (key, value) ->
      when (value) {
        is JsonObject -> map.putMap(key, value.toWritableMap())
        is JsonArray -> map.putArray(key, value.toWritableArray())
        is JsonPrimitive -> map.putPrimitiveValue(key, value)
        is JsonNull -> map.putNull(key)
        else -> map.putString(key, value.toString())
      }
    }
    return map
  }

  /**
   * Converts a JsonArray into a WritableArray for React Native.
   *
   * Recursively processes all elements, converting nested objects and arrays
   * into their corresponding WritableMap and WritableArray types.
   *
   * @return A WritableArray containing the converted JSON array data.
   */
  internal fun JsonArray.toWritableArray(): WritableArray {
    val array = Arguments.createArray()
    forEach { value ->
      when (value) {
        is JsonObject -> array.pushMap(value.toWritableMap())
        is JsonArray -> array.pushArray(value.toWritableArray())
        is JsonPrimitive -> array.pushPrimitiveValue(value)
        is JsonNull -> array.pushNull()
        else -> array.pushString(value.toString())
      }
    }
    return array
  }

  /**
   * Puts a JsonPrimitive value into a WritableMap using the appropriate native type.
   *
   * Automatically determines the primitive type (Boolean, Int, Double, String, or null)
   * and uses the corresponding WritableMap method.
   *
   * @param key The key for the map entry.
   * @param value The JsonPrimitive value to insert.
   */
  internal fun WritableMap.putPrimitiveValue(key: String, value: JsonPrimitive) {
    when (val primitiveValue = value.toPrimitiveValue()) {
      null -> putNull(key)
      is Boolean -> putBoolean(key, primitiveValue)
      is Int -> putInt(key, primitiveValue)
      is Double -> putDouble(key, primitiveValue)
      is String -> putString(key, primitiveValue)
      else -> putString(key, primitiveValue.toString())
    }
  }

  /**
   * Pushes a JsonPrimitive value into a WritableArray using the appropriate native type.
   *
   * Automatically determines the primitive type (Boolean, Int, Double, String, or null)
   * and uses the corresponding WritableArray method.
   *
   * @param value The JsonPrimitive value to push.
   */
  internal fun WritableArray.pushPrimitiveValue(value: JsonPrimitive) {
    when (val primitiveValue = value.toPrimitiveValue()) {
      null -> pushNull()
      is Boolean -> pushBoolean(primitiveValue)
      is Int -> pushInt(primitiveValue)
      is Double -> pushDouble(primitiveValue)
      is String -> pushString(primitiveValue)
      else -> pushString(primitiveValue.toString())
    }
  }

  /**
   * Converts a JsonPrimitive into a Kotlin value suitable for the React Native bridge.
   *
   * @return The converted primitive value (Boolean, Int, Double, String), or null for null values.
   */
  internal fun JsonPrimitive.toPrimitiveValue(): Any? {
    if (isString) {
      return content
    }

    content.toBooleanStrictOrNull()?.let { return it }

    content.toLongOrNull()?.let { longValue ->
      return if (longValue in Int.MIN_VALUE..Int.MAX_VALUE) {
        longValue.toInt()
      } else {
        longValue.toDouble()
      }
    }

    content.toDoubleOrNull()?.let { return it }

    return content
  }

  /**
   * Converts a ReadableMap into a JsonObject for callback initialization.
   *
   * @return A JsonObject representing the same data structure.
   */
  internal fun ReadableMap.toJsonObject(): JsonObject {
    val map = mutableMapOf<String, JsonElement>()
    val iterator = keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      map[key] = when (getType(key)) {
        ReadableType.Null -> JsonNull
        ReadableType.Boolean -> JsonPrimitive(getBoolean(key))
        ReadableType.Number -> JsonPrimitive(getDouble(key))
        ReadableType.String -> getString(key)?.let { JsonPrimitive(it) } ?: JsonNull
        ReadableType.Array -> getArray(key)?.toJsonArray() ?: JsonNull
        ReadableType.Map -> getMap(key)?.toJsonObject() ?: JsonNull
      }
    }
    return JsonObject(map)
  }

  /**
   * Converts a ReadableArray into a JsonArray for callback initialization.
   *
   * @return A JsonArray representing the same data structure.
   */
  internal fun ReadableArray.toJsonArray(): JsonArray {
    val elements = mutableListOf<JsonElement>()
    for (index in 0 until size()) {
      elements += when (getType(index)) {
        ReadableType.Null -> JsonNull
        ReadableType.Boolean -> JsonPrimitive(getBoolean(index))
        ReadableType.Number -> JsonPrimitive(getDouble(index))
        ReadableType.String -> getString(index)?.let { JsonPrimitive(it) } ?: JsonNull
        ReadableType.Array -> getArray(index)?.toJsonArray() ?: JsonNull
        ReadableType.Map -> getMap(index)?.toJsonObject() ?: JsonNull
      }
    }
    return JsonArray(elements)
  }
}
