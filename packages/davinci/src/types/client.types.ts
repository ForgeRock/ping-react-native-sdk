/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { DaVinciNextInput, DaVinciStartOptions } from './config.types';
import type {
  DaVinciNode,
  DaVinciPollStatusOptions,
  DaVinciUserSession,
  PollingStatus,
} from './node.types';

/**
 * DaVinci imperative client API contract.
 *
 * @remarks
 * Obtain an instance via {@link createDaVinciClient}.
 *
 * @example
 * ```ts
 * const client = createDaVinciClient({ modules: { oidc: { ... } } });
 *
 * const firstNode = await client.start();
 * // ... collect user input ...
 * const nextNode = await client.next({ collectors: [{ key: 'username', value: 'alice' }] });
 *
 * if (nextNode.type === 'SuccessNode') {
 *   const session = await client.user();
 *   console.log('Access token:', session?.accessToken);
 * }
 * ```
 *
 * @public
 */
export type DaVinciClient = {
  /**
   * Start the DaVinci flow.
   *
   * @remarks
   * The flow entry point is determined by the discovery URL in config — no name is
   * passed at runtime (unlike Journey). Each call starts a fresh flow.
   *
   * @param options - Optional start flags, such as `verificationUri` for RFC 8628
   * device-flow approval.
   * @returns The first flow node.
   * @throws {DaVinciError} When start fails.
   */
  start: (options?: DaVinciStartOptions) => Promise<DaVinciNode>;

  /**
   * Advance the active DaVinci flow by applying collector values.
   *
   * @param input - Key-indexed collector values to apply before advancing.
   * @returns Next flow node.
   * @throws {DaVinciError} When value application or progression fails.
   */
  next: (input: DaVinciNextInput) => Promise<DaVinciNode>;

  /**
   * Resolve the active user session.
   *
   * @returns Session payload, or `null` when no active session exists.
   * @throws {DaVinciError} When session retrieval fails.
   */
  user: () => Promise<DaVinciUserSession | null>;

  /**
   * Refresh the active user session tokens.
   *
   * @returns Refreshed session payload, or `null` when no active session exists.
   * @throws {DaVinciError} When refresh fails.
   */
  refresh: () => Promise<DaVinciUserSession | null>;

  /**
   * Revoke the active user access/refresh tokens.
   *
   * @returns `true` when revocation completes.
   * @throws {DaVinciError} When revocation fails.
   */
  revoke: () => Promise<boolean>;

  /**
   * Resolve userinfo claims for the active session.
   *
   * @returns Userinfo payload, or `null` when no active session exists.
   * @throws {DaVinciError} When userinfo retrieval fails.
   */
  userinfo: () => Promise<Record<string, unknown> | null>;

  /**
   * Log out the active user and clear the session.
   *
   * @returns Promise resolved when logout completes.
   * @throws {DaVinciError} When logout fails.
   */
  logoutUser: () => Promise<void>;

  /**
   * Dispose the native DaVinci instance and release runtime state.
   *
   * @returns Promise resolved when disposal completes.
   * @throws {DaVinciError} When disposal fails.
   */
  dispose: () => Promise<void>;

  /**
   * Returns the native DaVinci instance identifier.
   *
   * @remarks
   * Used by cross-module integrations (e.g. `@ping-identity/rn-external-idp`)
   * to target the correct native DaVinci instance without direct package coupling.
   * Satisfies the {@link DaVinciInstance} contract from `@ping-identity/rn-types`.
   *
   * @returns The internal DaVinci instance id.
   * @throws {DaVinciError} When configuration fails.
   */
  getId: () => Promise<string>;

  /**
   * Streams {@link PollingStatus} updates for the active `PollingCollector`
   * on the current node.
   *
   * @remarks
   * Does not auto-advance the flow — the consumer must call `next()`
   * explicitly on any terminal status (`complete`, `timedOut`, `expired`,
   * `error`) to progress past it. The returned unsubscribe function stops
   * local event delivery only — neither native SDK exposes a primitive to
   * cancel an in-flight poll, so the native poll keeps running to completion
   * (bounded by `pollRetries` × `pollInterval`) even after unsubscribing.
   *
   * @param onStatus - Callback invoked with each streamed {@link PollingStatus} tick.
   * @param options - Optional collector selection (`key`), when more than one
   *   `PollingCollector` is present on the active node.
   * @returns An unsubscribe function that stops local event delivery. It does
   *   not stop the native poll, which cannot be cancelled.
   * @throws {DaVinciError} When no active `PollingCollector` is resolved.
   */
  pollStatus: (
    onStatus: (status: PollingStatus) => void,
    options?: DaVinciPollStatusOptions,
  ) => Promise<() => void>;
};
