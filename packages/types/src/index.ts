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
 * Error category used across native-backed RN modules.
 *
 * @remarks
 * Derived from ForgeRock SDK types to keep error categories in sync.
 */
export type ErrorType = GenericError['type'];
