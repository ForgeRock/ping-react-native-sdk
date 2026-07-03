/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback } from 'react';
import {
  useDaVinci,
  useDaVinciForm,
  type DaVinciError,
  type DaVinciFormResult,
  type DaVinciNode,
} from '@ping-identity/rn-davinci';
import { useDaVinciSessionController } from './useDaVinciSessionController';
import { useDaVinciAutoStartEffect } from './useDaVinciAutoStartEffect';

/**
 * Result contract consumed by `DaVinciClientPanel`.
 */
export type UseDaVinciClientPanelControllerResult = {
  /** Active DaVinci node. */
  node: DaVinciNode | null;
  /** Headless form state for the active continue node. */
  form: DaVinciFormResult;
  /** True while a DaVinci action is in flight. */
  loading: boolean;
  /** Last hook-level DaVinci error. */
  error: DaVinciError | null;
  /** True when a session is confirmed active for the current DaVinci client. */
  hasActiveSession: boolean;
  /** True while the initial session bootstrap check is running. */
  isSessionCheckRunning: boolean;
  /**
   * Submits the current form by calling `next` with the planned payload.
   */
  onSubmit: () => void;
  /**
   * Submits a flow collector (`SUBMIT_BUTTON`, `ACTION`, `FLOW_BUTTON`,
   * `FLOW_LINK`) by key.
   *
   * @param flowKey - Flow collector key.
   */
  onFlowAction: (flowKey: string) => void;
  /** Restarts the DaVinci flow. */
  onStart: () => Promise<void>;
  /** Logs out the active user and clears local session state. */
  onLogout: () => Promise<void>;
};

/**
 * Options for the DaVinci client panel controller hook.
 */
export type UseDaVinciClientPanelControllerOptions = {
  /**
   * Optional callback fired after the user dismisses a `SuccessNode` or logs
   * out from the panel.
   */
  onAuthenticated?: () => void;
};

/**
 * Composes DaVinci sample panel behavior into a single controller hook.
 *
 * @remarks
 * - Checks for an active session on focus before auto-starting.
 * - Auto-starts the flow only when no node and no active session are present.
 * - Pairs `useDaVinci` (flow + session actions) with `useDaVinciForm` (form
 *   state for the active continue node) and exposes a flat panel contract.
 *
 * @param options - Optional controller options.
 * @returns Panel state and actions consumed by `DaVinciClientPanel`.
 */
export function useDaVinciClientPanelController(
  options: UseDaVinciClientPanelControllerOptions = {},
): UseDaVinciClientPanelControllerResult {
  const { onAuthenticated } = options;
  const { node, loading, error, start, next, user, logoutUser } = useDaVinci();
  const form = useDaVinciForm(node);

  const { hasActiveSession, setHasActiveSession, isSessionCheckRunning } =
    useDaVinciSessionController({
      user,
      nodeType: node?.type,
    });

  const onStart = useCallback(async (): Promise<boolean> => {
    try {
      await start();
      return true;
    } catch {
      // The hook captures and exposes the error via `error`.
      return false;
    }
  }, [start]);

  useDaVinciAutoStartEffect({
    loading,
    isSessionCheckRunning,
    hasActiveSession,
    node,
    onStart,
  });

  const onSubmit = useCallback((): void => {
    if (loading) {
      return;
    }
    const plan = form.buildInput();
    if (!plan.canSubmit) {
      return;
    }
    next(plan.input).catch(() => {
      // `error` is already updated by the hook.
    });
  }, [form, loading, next]);

  const onFlowAction = useCallback(
    (flowKey: string): void => {
      if (loading) {
        return;
      }
      form.submitFlow(flowKey).catch(() => {
        // `error` is already updated by the hook.
      });
    },
    [form, loading],
  );

  const onStartAction = useCallback(async (): Promise<void> => {
    await onStart();
  }, [onStart]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      await logoutUser();
    } catch {
      // The hook surfaces the error via `error`.
    } finally {
      setHasActiveSession(false);
      onAuthenticated?.();
    }
  }, [logoutUser, onAuthenticated, setHasActiveSession]);

  return {
    node,
    form,
    loading,
    error,
    hasActiveSession,
    isSessionCheckRunning,
    onSubmit,
    onFlowAction,
    onStart: onStartAction,
    onLogout,
  };
}
