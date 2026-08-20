/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  CallbackType,
  NativeExtensionCallbackType,
  Node,
  NodeCallback,
} from '@ping-identity/rn-types';

/**
 * Node discriminator returned by the Journey bridge.
 */
export type JourneyNodeType =
  | 'ContinueNode'
  | 'ErrorNode'
  | 'FailureNode'
  | 'SuccessNode';

/**
 * Callback type union used by Journey types.
 *
 * @remarks
 * Includes known SDK callback literals and declared native-extension callback
 * literals used by React Native Journey integrations.
 */
export type JourneyCallbackType =
  | Exclude<CallbackType, 'RedirectCallback'>
  | NativeExtensionCallbackType;

/**
 * Native callback payload surfaced to JavaScript.
 *
 * @remarks
 * Extends shared callback shape while widening `type` so native-extension callbacks
 * are represented without type assertions.
 */
export type JourneyCallback = Omit<NodeCallback, 'type'> & {
  /** Native callback type (for example, `NameCallback`). */
  type: JourneyCallbackType;
  /** Optional user-facing prompt string emitted by native. */
  prompt?: string;
  /** Optional user-facing message emitted by native. */
  message?: string;
  /** Optional callback value emitted by native. */
  value?: unknown;
  /** Optional callback metadata emitted by native. */
  [key: string]: unknown;
};

/**
 * Journey node payload returned by native execution.
 *
 * @remarks
 * Extends shared node shape while replacing `callbacks` with Journey-native callback payloads.
 */
export type JourneyNode = Omit<Node, 'callbacks'> & {
  /** Terminal/non-terminal node discriminator. */
  type?: JourneyNodeType;
  /** Optional node-level message from native/server. */
  message?: string;
  /** Optional failure cause message for `FailureNode`. */
  cause?: string;
  /** Optional raw input payload from native node. */
  input?: Record<string, unknown>;
  /** Callback collection when additional user input is required. */
  callbacks?: JourneyCallback[];
  /**
   * Optional page header text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. On iOS this normalizes the native
   * `pageHeader` property to this shared field name.
   */
  header?: string;
  /**
   * Optional page description text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. On iOS this normalizes the native
   * `pageDescription` property to this shared field name.
   */
  description?: string;
  /**
   * Optional raw stage JSON string for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`.
   */
  stage?: string;
  /**
   * Optional locale-resolved submit button text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. Resolved by the native SDK from the
   * `stage` locale map using the device's preferred locale.
   */
  submitButtonText?: string;
  /**
   * Optional locale-resolved page footer text for `ContinueNode` payloads.
   *
   * @remarks
   * Populated only for `ContinueNode`. Resolved by the native SDK from the
   * `stage` locale map using the device's preferred locale.
   */
  pageFooter?: string;
};
