/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndeviceprofile

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
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
import com.reactnativepingidentity.core.CoreRuntime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

/**
 * Common device profile collection utilities shared across architectures.
 * TODO: Add logging once logger module is available and error shapes
 */
object RNPingDeviceProfileCommon {
  private const val LOCATION_SERVICES_CLASS =
    "com.google.android.gms.location.LocationServices"
  private val scope = CoroutineScope(Dispatchers.IO)
  private const val LOCATION_ERROR_MESSAGE =
    "LocationCollector requires Google Play Services Location. Add " +
      "\"com.google.android.gms:play-services-location\" to your app dependencies."

  internal var locationServicesClassResolver: (String) -> java.lang.Class<*> =
    { java.lang.Class.forName(it) }

  /**
   * Validates that location services are available if the location collector is requested.
   *
   * @param collectorTypes List of collector type names.
   * @param promise Promise to reject if location is unavailable.
   * @return true if validation passes, false if location is required but unavailable.
   */
  private fun validateLocationAvailability(
    collectorTypes: List<String>,
    promise: Promise
  ): Boolean {
    if (collectorTypes.contains("location") && !isLocationServicesAvailable()) {
      Log.w(
        "Device Profile",
        "location collection blocked: $LOCATION_ERROR_MESSAGE"
      )
      promise.resolve(
        createJourneyResultPayload(
          type = "error",
          code = "DEVICE_PROFILE_LOCATION_UNAVAILABLE",
          message = LOCATION_ERROR_MESSAGE
        )
      )
      return false
    }
    return true
  }

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
  @JvmStatic
  fun collectDeviceProfile(collectorNames: ReadableArray, promise: Promise) {
    val collectorTypes = readCollectors(collectorNames)

    if (!validateLocationAvailability(collectorTypes, promise)) {
      return
    }

    Log.d("Device Profile", "metadata collection starting")

    scope.launch {
      try {
        val deviceCollectors = buildCollectors(collectorTypes, includeLocation = true)
        val jsonElement = if (deviceCollectors.isEmpty()) {
          JsonObject(emptyMap())
        } else {
          deviceCollectors.collect()
        }
        Log.d("Device Profile", "metadata collection succeeded")
        promise.resolve(jsonElement.toReactValue())
      } catch (e: Throwable) {
        Log.e("Device Profile", "metadata collection failed", e)
        promise.reject("DEVICE_PROFILE_COLLECT_ERROR", "Failed to collect device profile: ${e.message}", e)
      }
    }
  }

  /**
   * Collects device profile information as part of a Journey authentication flow.
   *
   * This method gathers device profile data specifically for Journey callbacks, using the
   * active DeviceProfileCallback from the current Journey node to ensure the profile is
   * bound to the correct Journey instance.
   *
   * @param journeyId The unique identifier for the Journey flow.
   * @param collectorNames Array of collector names to use for profile collection.
   * @param promise React Native promise that resolves with the collected device profile result or rejects with an error.
   */
  @JvmStatic
  fun collectDeviceProfileForJourney(
    journeyId: String,
    collectorNames: ReadableArray,
    promise: Promise
  ) {
    val collectorTypes = readCollectors(collectorNames)

    if (!validateLocationAvailability(collectorTypes, promise)) {
      return
    }

    Log.d(
      "Device Profile",
      "metadata collection for journey starting"
    )

    scope.launch {
      try {
        val metadataCollectors = buildCollectors(collectorTypes, includeLocation = false)
        val callback = resolveDeviceProfileCallback(journeyId)
        if (callback == null) {
          promise.resolve(
            createJourneyResultPayload(
              type = "error",
              code = "DEVICE_PROFILE_CALLBACK_NOT_FOUND",
              message = "No active Device Profile callback found for journey $journeyId."
            )
          )
          return@launch
        }

        val result = callback.collect {
          collectors {
            addAll(metadataCollectors)
          }
        }

        result.fold(
          onSuccess = {
            Log.d(
              "Device Profile",
              "metadata collection for journey succeeded"
            )
            promise.resolve(
              createJourneyResultPayload(type = "success")
            )
          },
          onFailure = { error ->
            Log.e(
              "Device Profile",
              "metadata collection for journey failed during callback",
              error
            )
            promise.resolve(
              createJourneyResultPayload(
                type = "error",
                code = "DEVICE_PROFILE_COLLECT_ERROR",
                message = "Failed to collect device profile for journey: ${error.message}"
              )
            )
          }
        )
      } catch (error: Throwable) {
        Log.e(
          "Device Profile",
          "metadata collection for journey failed during collection",
          error
        )
        promise.resolve(
          createJourneyResultPayload(
            type = "error",
            code = "DEVICE_PROFILE_COLLECT_ERROR",
            message = "Failed to collect device profile for journey: ${error.message}"
          )
        )
      }
    }
  }

  private fun createJourneyResultPayload(
    type: String,
    code: String? = null,
    message: String? = null
  ): WritableMap {
    return Arguments.createMap().apply {
      putString("type", type)
      code?.let { putString("code", it) }
      message?.let { putString("message", it) }
    }
  }

  /**
   * Resolves the Device Profile callback for the active Journey callbacks.
   */
  private suspend fun resolveDeviceProfileCallback(journeyId: String): DeviceProfileCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.firstOrNull { it is DeviceProfileCallback } as? DeviceProfileCallback
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
   * Checks whether Google Play Services Location is available on the classpath.
   */
  private fun isLocationServicesAvailable(): Boolean = try {
    locationServicesClassResolver(LOCATION_SERVICES_CLASS)
    true
  } catch (_: ClassNotFoundException) {
    false
  } catch (_: NoClassDefFoundError) {
    false
  } catch (_: SecurityException) {
    false
  } catch (_: LinkageError) {
    false
  }

}
