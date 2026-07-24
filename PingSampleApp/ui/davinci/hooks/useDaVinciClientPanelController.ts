/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  useDaVinci,
  useDaVinciContext,
  useDaVinciForm,
  type DaVinciError,
  type DaVinciFormResult,
  type DaVinciNode,
  type IdpCollector,
} from '@ping-identity/rn-davinci';
import { createExternalIdpClient } from '@ping-identity/rn-external-idp';
import { logger } from '@ping-identity/rn-logger';
import Config from 'react-native-config';
import { useDaVinciSessionController } from './useDaVinciSessionController';
import { useDaVinciAutoStartEffect } from './useDaVinciAutoStartEffect';
import { useDaVinciAutoForwarder } from './useDaVinciAutoForwarder';

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
  /** Last IdP-authorize error message (cleared on next start). */
  idpError: string | null;
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
   * @remarks
   * Delegates to `form.setValue`, which auto-submits immediately for
   * `FlowCollector` keys — see {@link useDaVinciForm}'s `setValue` remarks.
   *
   * @param flowKey - Flow collector key.
   */
  onFlowAction: (flowKey: string) => void;
  /**
   * Launches the social login browser flow for an IDP collector, then
   * automatically advances the DaVinci flow via `next()`.
   *
   * @param collector - The IdpCollector to authorize.
   */
  onIdpAuthorize: (collector: IdpCollector) => Promise<void>;
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
  const davinciContext = useDaVinciContext();
  const { node, loading, error, start, next, user, logoutUser } = useDaVinci();
  const externalIdpLogger = useMemo(() => logger({ level: 'debug' }), []);
  const externalIdp = useMemo(
    () =>
      createExternalIdpClient({
        redirectUri: Config.PINGONE_REDIRECT_URI ?? '',
        logger: externalIdpLogger,
      }),
    [externalIdpLogger],
  );
  const form = useDaVinciForm(node, {
    handledCollectorTypes: new Set(['SOCIAL_LOGIN_BUTTON']),
  });

  const [idpError, setIdpError] = useState<string | null>(null);
  const [idpJustAuthorized, setIdpJustAuthorized] = useState<boolean>(false);

  const { hasActiveSession, setHasActiveSession, isSessionCheckRunning } =
    useDaVinciSessionController({
      user,
      nodeType: node?.type,
    });

  const onStart = useCallback(async (): Promise<boolean> => {
    setIdpError(null);
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

  const continueNodeKey = useMemo(() => {
    if (node?.type !== 'ContinueNode') return '';
    return node.collectors.map(c => c.key ?? c.type).join(',');
  }, [node]);

  useDaVinciAutoForwarder({
    node,
    form,
    loading,
    continueNodeKey,
    enabled: idpJustAuthorized,
    onForwarded: () => setIdpJustAuthorized(false),
    next,
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

  const onIdpAuthorize = useCallback(
    async (collector: IdpCollector): Promise<void> => {
      if (loading) {
        return;
      }
      const davinciClient = davinciContext?.client;
      if (!davinciClient) {
        console.warn(
          '[DaVinci] authorizeForDaVinci: no DaVinci client in context',
        );
        return;
      }
      // Determine which index this collector occupies among IDP collectors on the
      // current node so the native side can resolve the right IdpCollector.
      const idpFields = form.fields.filter(
        f => f.type === 'SOCIAL_LOGIN_BUTTON',
      );
      const index = idpFields.findIndex(f => f.key === collector.key);
      try {
        // authorizeForDaVinci opens the IdP browser flow and sets the
        // resume request internally — token flows through the subsequent next().
        await externalIdp.authorizeForDaVinci(davinciClient, {
          index: index >= 0 ? index : 0,
        });
        setIdpJustAuthorized(true);
        await next({ collectors: [] });
      } catch (err) {
        console.warn('[DaVinci] authorizeForDaVinci failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setIdpError(msg);
      }
    },
    [davinciContext?.client, externalIdp, form.fields, loading, next],
  );

  const onFlowAction = useCallback(
    (flowKey: string): void => {
      if (loading) {
        return;
      }
      // setValue on a FlowCollector key auto-submits via next() immediately
      // (see useDaVinciForm's setValue remarks) — exercises the same
      // auto-submit path a field's onChange would trigger.
      const pending = form.setValue(flowKey, flowKey);
      pending?.catch(() => {
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
    idpError,
    hasActiveSession,
    isSessionCheckRunning,
    onSubmit,
    onFlowAction,
    onIdpAuthorize,
    onStart: onStartAction,
    onLogout,
  };
}
