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