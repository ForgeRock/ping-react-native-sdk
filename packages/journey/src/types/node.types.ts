/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  CallbackType,
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
 * Includes known SDK callback literals while allowing native-extension callback
 * strings that are not yet part of shared SDK types.
 */
export type JourneyCallbackType = CallbackType | (string & {});

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
};
