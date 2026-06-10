/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Native module specification for `RNPingDeviceClient`.
 *
 * @remarks
 * This interface follows a **handle-based lifecycle pattern** so that a single
 * React Native application can own multiple Device Client instances
 * simultaneously (e.g. one per active session).
 *
 * Each call to {@link Spec.create} allocates a native `DeviceClient` and
 * returns a string handle id. All subsequent operations ({@link Spec.get},
 * {@link Spec.update}, {@link Spec.deleteDevice}, {@link Spec.destroy})
 * reference that handle id.
 *
 * The JS-side {@link createDeviceClient} factory lazily calls `create` and
 * caches the handle, so most consumers never interact with `Spec` directly.
 *
 * **Codegen note:** React Native TurboModule codegen requires `Object` in
 * native spec signatures, hence the eslint disable for `no-wrapper-object-types`.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Creates a native DeviceClient instance from the serialized configuration.
   *
   * @param config - Serialized {@link DeviceClientConfig} object containing
   *   `serverUrl`, `ssoToken`, `realm`, `cookieName`, and optionally `loggerId`.
   * @returns A promise resolving to the opaque handle id string used by all
   *   subsequent operations on this client.
   * @throws `DEVICE_CLIENT_MISSING_CONFIG` when required fields are absent.
   */
  create(config: Object): Promise<string>;

  /**
   * Fetches all devices of the given kind for the active user.
   *
   * @param handleId - Native handle id returned by {@link Spec.create}.
   * @param deviceType - One of the {@link DeviceKind} strings:
   *   `'oath' | 'push' | 'bound' | 'profile' | 'webAuthn'`.
   * @returns A promise resolving to `{ result: Device[] }` where `Device`
   *   matches the shape of the corresponding device interface.
   * @throws `DEVICE_CLIENT_HANDLE_NOT_FOUND` when the handle has been
   *   destroyed or was never created.
   * @throws `DEVICE_CLIENT_INVALID_TOKEN` when the SSO token has expired.
   */
  get(handleId: string, deviceType: string): Promise<Object>;

  /**
   * Updates a device record on the server.
   *
   * @param handleId - Native handle id.
   * @param deviceType - The {@link DeviceKind} of the device.
   * @param device - Serialized device payload with updated fields.
   * @returns A promise resolving to `{ result: Device }` containing the
   *   server-acknowledged device.
   * @throws `DEVICE_CLIENT_NOT_FOUND` when the device does not exist.
   * @throws `DEVICE_CLIENT_REQUEST_FAILED` on server-side validation errors.
   */
  update(handleId: string, deviceType: string, device: Object): Promise<Object>;

  /**
   * Deletes a device from the server.
   *
   * @remarks
   * Named `deleteDevice` instead of `delete` because `delete` is a reserved
   * keyword in C++; the TurboModule codegen would emit invalid C++ otherwise.
   *
   * @param handleId - Native handle id.
   * @param deviceType - The {@link DeviceKind} of the device.
   * @param device - Serialized device payload (the `id` field is used for lookup).
   * @returns A promise resolving to `{ result: Device }` containing the
   *   deleted device.
   * @throws `DEVICE_CLIENT_NOT_FOUND` when the device does not exist.
   */
  deleteDevice(
    handleId: string,
    deviceType: string,
    device: Object,
  ): Promise<Object>;

  /**
   * Releases native resources for the given handle.
   *
   * @remarks
   * After this call, any operation referencing the same `handleId` will
   * reject with `DEVICE_CLIENT_HANDLE_NOT_FOUND`.
   *
   * @param handleId - Native handle id to release.
   * @returns A promise that resolves once native resources are freed.
   */
  dispose(handleId: string): Promise<void>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Resolves the native `RNPingDeviceClient` module at runtime.
 *
 * @remarks
 * Probes the TurboModule registry first (New Architecture), then falls back
 * to the classic bridge module (`RNPingDeviceClientClassic`) for apps that
 * have not yet migrated to the New Architecture.
 *
 * This function is called once per {@link createDeviceClient} invocation and
 * the result is cached for the lifetime of that client.
 *
 * @returns The resolved native module conforming to {@link Spec}.
 * @throws Error when neither the TurboModule nor the classic bridge module
 *   is available. The error message includes the list of available
 *   `NativeModules` keys for debugging.
 */
let _nativeModule: Spec | null = null;
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingDeviceClient');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingDeviceClientClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules = __DEV__
    ? '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules))
    : '';
  throw new Error(
    '[@ping-identity/rn-device-client] Native module RNPingDeviceClient not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}
