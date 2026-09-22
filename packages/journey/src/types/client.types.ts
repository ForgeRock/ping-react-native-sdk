/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  JourneyBackchannelOptions,
  JourneyNextInput,
  JourneyStartOptions,
} from './config.types';
import type { JourneyNode } from './node.types';
import type {
  JourneySSOToken,
  JourneyUserInfo,
  JourneyUserSession,
} from './session.types';

/**
 * Journey imperative client API contracts.
 */

/**
 * Native-backed Journey client contract.
 */
export type JourneyClient = {
  /**
   * Explicitly initialize the native Journey instance.
   *
   * @returns Native Journey instance identifier.
   * @throws {JourneyError} When the Journey cannot be configured.
   */
  init: () => Promise<string>;

  /**
   * Returns the native Journey instance identifier.
   *
   * @returns Native Journey instance identifier.
   * @throws {JourneyError} When the Journey is not configured.
   */
  getId: () => Promise<string>;

  /**
   * Start a Journey by name.
   *
   * @param journeyName - Journey/tree name configured on the server.
   * @param options - Optional start flags.
   * @returns The first Journey node.
   * @throws {JourneyError} When start fails.
   */
  start: (
    journeyName: string,
    options?: JourneyStartOptions,
  ) => Promise<JourneyNode>;

  /**
   * Start a Journey from an AM/AIC backchannel (transactional) redirect URI.
   *
   * The gateway federation service initializes the transaction via AM's
   * `/authenticate/backchannel/initialize` endpoint and delivers the returned
   * `redirectUri` to the app through its own channel (push notification, QR
   * code, deep link). This method extracts the `authIndexType` and
   * `authIndexValue` query parameters from the URI and drives the standard
   * Journey authenticate flow — the URI itself is never opened as a browser
   * URL, and the authenticate endpoint is always reconstructed from the
   * Journey config (`serverUrl` + `realm`).
   *
   * @param uri - Gateway-provided `redirectUri` value.
   * @param options - Optional backchannel flags. Both default to `false`,
   * matching native behavior.
   * @returns The first Journey node, using the same node contract as
   * `start`/`resume`. URI validation failures (missing config, malformed URI,
   * missing or whitespace-only `authIndexType`/`authIndexValue`, URI host not
   * matching the configured `serverUrl`) resolve as `FailureNode` payloads
   * without a network call; expired/not-found/completed transactions surface
   * AM's message on an `ErrorNode`.
   * @throws {JourneyError} With `argument_error` when the URI is empty or
   * whitespace-only, and for bridge-level failures.
   * @example
   * ```ts
   * // Gateway payload: { transaction, redirectUri }
   * const node = await client.startBackchannel(payload.redirectUri);
   * if (node.type === 'ContinueNode') {
   *   // render step-up callbacks, then: client.next(...)
   * }
   * ```
   * @remarks
   * Mirrors the native `start(backchannelUri:)` capability (SDKS-5156 iOS /
   * SDKS-5157 Android). `authIndexType` is parsed from the URI rather than
   * hardcoded to `transaction`. URI validation runs natively before any
   * network call on both platforms with identical outcomes. Host validation
   * only establishes that the URI names the configured server; it does not
   * establish that the transaction belongs to the current user — confirm
   * transaction details with the user before completing the flow.
   */
  startBackchannel: (
    uri: string,
    options?: JourneyBackchannelOptions,
  ) => Promise<JourneyNode>;

  /**
   * Advance an active Journey by applying callback input.
   *
   * @param input - Callback value payload for the active node.
   * @returns Next Journey node.
   * @throws {JourneyError} When callback application or progression fails.
   */
  next: (input?: JourneyNextInput) => Promise<JourneyNode>;

  /**
   * Resume a suspended Journey flow from a deep link URL.
   *
   * @param uri - Resume URI provided by native/server.
   * @returns Resumed Journey node.
   * @throws {JourneyError} When resume fails.
   */
  resume: (uri: string) => Promise<JourneyNode>;

  /**
   * Resolve active user session details.
   *
   * @returns Session payload, or `null` when no active session exists.
   * @throws {JourneyError} When session retrieval fails.
   */
  user: () => Promise<JourneyUserSession | null>;

  /**
   * Refresh active Journey user access token.
   *
   * @returns Refreshed session payload, or `null` when no active session exists.
   * @throws {JourneyError} When refresh fails.
   */
  refresh: () => Promise<JourneyUserSession | null>;

  /**
   * Revoke active Journey user access/refresh tokens.
   *
   * @returns `true` when revoke completes.
   * @throws {JourneyError} When revoke fails.
   */
  revoke: () => Promise<boolean>;

  /**
   * Resolve active Journey userinfo claims.
   *
   * @returns Userinfo payload, or `null` when no active session exists.
   * @throws {JourneyError} When userinfo retrieval fails.
   */
  userinfo: () => Promise<JourneyUserInfo | null>;

  /**
   * Resolve active Journey SSO token payload.
   *
   * @returns SSO token payload, or `null` when no active session exists.
   * @throws {JourneyError} When SSO token retrieval fails.
   */
  ssoToken: () => Promise<JourneySSOToken | null>;

  /**
   * Logout active Journey user/session.
   *
   * @returns `true` when logout succeeds.
   * @throws {JourneyError} When logout fails.
   */
  logoutUser: () => Promise<boolean>;

  /**
   * Dispose the native Journey instance and release runtime state.
   *
   * @returns Promise resolved when disposal completes.
   * @throws {JourneyError} When disposal fails.
   */
  dispose: () => Promise<void>;
};
