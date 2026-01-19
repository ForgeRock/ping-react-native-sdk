/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
/**
 * Global type declarations for React Native Turbo Modules.
 * 
 * Declares the __turboModuleProxy global variable used by React Native's
 * New Architecture to enable Turbo Module support detection.
 */
declare global {
  /** 
   * Turbo Module proxy object used to detect New Architecture support.
   * Present and non-null when New Architecture (Fabric/TurboModules) is enabled.
   */
  var __turboModuleProxy: object | undefined;
}

export {};