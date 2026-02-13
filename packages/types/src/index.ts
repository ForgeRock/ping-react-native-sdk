/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

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
export type {
  Callback,
  CallbackType,
  Step,
  StepDetail,
  AuthResponse,
  FailureDetail,
  PolicyRequirement,
  PolicyParams,
  ServerConfig,
  AsyncServerConfig,
  LegacyConfigOptions,
  ValidLegacyConfigOptions,
  WellKnownResponse,
  Tokens,
  CustomStorageObject,
  OAuthConfig,
  DavinciOAuthConfig,
  PathsConfig,
  GetAuthorizationUrlOptions,
  GenerateAndStoreAuthUrlValues,
  ResponseType,
} from '@forgerock/sdk-types';

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
 * TODO: Add RN native-extension callback constants (for example, FIDO, Binding,
 * IdP, and ConsentMapping variants) once they are standardized in shared types.
 */
