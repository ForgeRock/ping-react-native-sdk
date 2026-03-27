/**
 * Re-export ForgeRock SDK types to keep a React Native scoped import surface.
 *
 * @remarks
 * These types remain structurally identical to the originals.
 */
export * from '@forgerock/sdk-types';
import type { GenericError } from '@forgerock/sdk-types';
/**
 * Explicit exports for core auth flow shapes used across modules.
 */
export type { Callback, CallbackType, Step, StepDetail, AuthResponse, FailureDetail, PolicyRequirement, PolicyParams, ServerConfig, AsyncServerConfig, LegacyConfigOptions, ValidLegacyConfigOptions, WellKnownResponse, Tokens, CustomStorageObject, OAuthConfig, DavinciOAuthConfig, PathsConfig, GetAuthorizationUrlOptions, GenerateAndStoreAuthUrlValues, ResponseType, } from '@forgerock/sdk-types';
/**
 * Error category used across native-backed RN modules.
 *
 * @remarks
 * Derived from ForgeRock SDK types to keep error categories in sync.
 */
export type ErrorType = GenericError['type'];
/**
 * Alias for a Journey node in RN flows.
 *
 * @remarks
 * ForgeRock SDK refers to these as `Step` objects.
 */
export type Node = import('@forgerock/sdk-types').Step;
/**
 * Alias for callback payloads used in RN flows.
 */
export type NodeCallback = import('@forgerock/sdk-types').Callback;
/**
 * React Native native-extension callback type constants not currently present in
 * ForgeRock shared sdk-types.
 */
export declare const nativeExtensionCallbackType: {
    readonly ConsentMappingCallback: "ConsentMappingCallback";
    readonly IdPCallback: "IdPCallback";
    readonly FidoRegistrationCallback: "FidoRegistrationCallback";
    readonly FidoAuthenticationCallback: "FidoAuthenticationCallback";
    readonly BindingCallback: "BindingCallback";
    readonly DeviceBindingCallback: "DeviceBindingCallback";
    readonly DeviceSigningVerifierCallback: "DeviceSigningVerifierCallback";
};
/**
 * Union of native-extension callback types used by RN Journey integrations.
 */
export type NativeExtensionCallbackType = (typeof nativeExtensionCallbackType)[keyof typeof nativeExtensionCallbackType];
/**
 * TODO(DX): Expose a single Journey callback constant source that merges
 * ForgeRock `callbackType` and `nativeExtensionCallbackType` so consumers do
 * not need to import from two separate constant maps.
 */
/**
 * Shared OIDC base configuration contracts used across RN modules.
 */
export type * from './oidc.types';
/**
 * Shared native handle and logger contracts used across RN modules.
 */
export type * from './handles.types';
export type JourneyInstance = {
    /**
     * Returns the native Journey instance identifier.
     */
    getId: () => Promise<string>;
};
//# sourceMappingURL=index.d.ts.map