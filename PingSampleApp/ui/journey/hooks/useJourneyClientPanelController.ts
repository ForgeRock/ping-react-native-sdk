/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useJourney,
  useJourneyForm,
  type JourneyClient,
  type JourneyError,
  type JourneyFormResult,
  type JourneyNextInput,
  type JourneyNode,
  type JourneyStartOptions,
} from '@ping-identity/rn-journey';
import { createFidoClient } from '@ping-identity/rn-fido';
import { collectDeviceProfile } from '@ping-identity/rn-device-profile';
import {
  resolveContinueNodeAutomationPolicy,
  resolvePollingWaitMs,
} from '../utils/clientPanel';
import { useJourneySessionController } from './useJourneySessionController';
import { useJourneyResumeController } from './useJourneyResumeController';
import { useJourneyDebugEntries } from './useJourneyDebugEntries';
import { useJourneyAutomationEffects } from './useJourneyAutomationEffects';
import { useJourneyDebugEffects } from './useJourneyDebugEffects';
import { useJourneyAutoStartEffect } from './useJourneyAutoStartEffect';

/**
 * Options for the Journey client panel controller hook.
 */
export type UseJourneyClientPanelControllerOptions = {
  /**
   * Journey client used for native instance resolution and callback execution.
   */
  journeyClient: JourneyClient;
  /**
   * Optional default journey name shown in the input.
   */
  initialJourneyName?: string;
  /**
   * Optional start options passed to `start(...)`.
   */
  startOptions?: JourneyStartOptions;
  /**
   * Enables auto-start when the panel mounts and no session/node is active.
   */
  autoStartOnMount?: boolean;
  /**
   * Optional callback invoked once when an authenticated Journey session is detected.
   */
  onAuthenticated?: () => void;
  /**
   * When true, waits for explicit user action on the success screen before invoking
   * `onAuthenticated`.
   */
  requireSuccessConfirmation?: boolean;
};

/**
 * Result contract consumed by `JourneyClientPanel`.
 */
export type UseJourneyClientPanelControllerResult = {
  /**
   * Active Journey node.
   */
  node: JourneyNode | null;
  /**
   * Headless helper form state for the active node.
   */
  form: JourneyFormResult;
  /**
   * Journey action loading state.
   */
  loading: boolean;
  /**
   * Last hook-level Journey error.
   */
  error: JourneyError | null;
  /**
   * Session bootstrap running state.
   */
  isSessionCheckRunning: boolean;
  /**
   * Debug log entries shown in the sample debug panel.
   */
  debugEntries: ReturnType<typeof useJourneyDebugEntries>['debugEntries'];
  /**
   * Clears current debug log entries.
   */
  clearDebugEntries: () => void;
  /**
   * Polling wait resolved from callback payload when present.
   */
  pollingWaitMs: number | null;
  /**
   * Resume URL input value.
   */
  resumeUrl: string;
  /**
   * Resume URL input setter.
   */
  setResumeUrl: (value: string) => void;
  /**
   * Executes manual journey resume.
   */
  onResume: () => Promise<void>;
  /**
   * Executes journey submit for current form state.
   */
  onSubmit: () => Promise<void>;
  /**
   * Logs out the current user/session.
   */
  onLogout: () => Promise<void>;
  /**
   * Explicit success continuation used when success confirmation is required.
   */
  onContinueAfterSuccess: () => void;
  /**
   * True when callback panel should be shown.
   */
  showCallbackScreen: boolean;
  /**
   * True when success actions should be shown.
   */
  showSuccessScreen: boolean;
};

type FidoIntegrationExecutionOptions = {
  continueOnAuthenticationCancel?: boolean;
};

type FidoIntegrationExecutionResult = {
  authenticationCancelled: boolean;
};

function trimStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readRecordField(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = trimStringValue(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function resolveDeviceNameFromDeviceProfile(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const root = profile as Record<string, unknown>;
  const platform = root.platform;
  if (!platform || typeof platform !== 'object') {
    return null;
  }

  const platformRecord = platform as Record<string, unknown>;
  return readRecordField(platformRecord, ['model', 'modelName']);
}

function isFidoAuthenticationCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'FIDO_AUTHENTICATE_CANCELLED';
}

/**
 * Composes Journey sample panel behavior into a single controller hook.
 *
 * @param options - Controller options.
 * @returns Controller state and actions consumed by `JourneyClientPanel`.
 */
export function useJourneyClientPanelController(
  options: UseJourneyClientPanelControllerOptions,
): UseJourneyClientPanelControllerResult {
  // TODO(DX): This controller currently owns lifecycle, FIDO integration, submit shaping,
  // and automation behavior. Split into focused hooks to reduce file-level complexity.
  const {
    journeyClient,
    initialJourneyName,
    startOptions,
    autoStartOnMount = false,
    onAuthenticated,
    requireSuccessConfirmation = false,
  } = options;

  const [journeyName, setJourneyName] = useState<string>(
    initialJourneyName ?? '',
  );
  const defaultSystemDeviceNameRef = useRef<string | null>(null);
  const fido = useMemo(() => createFidoClient({}), []);
  const [node, actions] = useJourney();
  const { start, next, resume, user, logoutUser, loading, error } = actions;
  const form = useJourneyForm(node);

  useEffect(() => {
    setJourneyName(initialJourneyName ?? '');
  }, [initialJourneyName]);

  const isContinueNode = node?.type === 'ContinueNode';
  const hasDeviceProfileCallback =
    form.getFieldsByType('DeviceProfileCallback').length > 0;
  const hasPollingWaitCallback =
    form.getFieldsByType('PollingWaitCallback').length > 0;
  const hasFidoRegistrationCallback =
    form.getFieldsByType('FidoRegistrationCallback').length > 0;
  const hasFidoAuthenticationCallback =
    form.getFieldsByType('FidoAuthenticationCallback').length > 0;
  const hasFidoCallback =
    hasFidoRegistrationCallback || hasFidoAuthenticationCallback;
  const hasSuspendedCallback =
    form.getFieldsByType('SuspendedTextOutputCallback').length > 0;
  const pollingWaitMs = useMemo<number | null>(
    () => resolvePollingWaitMs(form.fields),
    [form.fields],
  );

  // Stable signature used to dedupe automation for logically identical ContinueNodes.
  const continueNodeKey = useMemo<string>(() => {
    if (!isContinueNode || form.fields.length === 0) {
      return '';
    }

    return form.fields
      .map(field => `${field.ref.type}:${field.ref.typeIndex}:${field.id}`)
      .join('|');
  }, [form.fields, isContinueNode]);

  // Narrow key that scopes device-profile automation to relevant callback instances.
  const deviceProfileRequestKey = useMemo<string>(() => {
    if (!isContinueNode || !hasDeviceProfileCallback) {
      return '';
    }

    return `${continueNodeKey}:${form.fields
      .filter(field => field.ref.type === 'DeviceProfileCallback')
      .map(field => `${field.ref.typeIndex}`)
      .join(',')}`;
  }, [continueNodeKey, form.fields, hasDeviceProfileCallback, isContinueNode]);

  const automationPolicy = useMemo(
    () =>
      resolveContinueNodeAutomationPolicy({
        isContinueNode,
        loading,
        fields: form.fields,
        hasDeviceProfileCallback,
        hasPollingWaitCallback,
        hasSuspendedCallback,
        hasUnsupportedCallbacks: form.meta.hasUnsupported,
        pollingWaitMs,
      }),
    [
      form.fields,
      form.meta.hasUnsupported,
      hasDeviceProfileCallback,
      hasPollingWaitCallback,
      hasSuspendedCallback,
      isContinueNode,
      loading,
      pollingWaitMs,
    ],
  );

  const {
    hasActiveSession,
    setHasActiveSession,
    isSessionCheckRunning,
    onContinueAfterSuccess,
  } = useJourneySessionController({
    user,
    nodeType: node?.type,
    onAuthenticated,
    requireSuccessConfirmation,
  });

  const { debugEntries, appendDebug, clearDebugEntries } =
    useJourneyDebugEntries();
  const lastAutoFidoAuthNodeKeyRef = useRef<string | null>(null);

  const { resumeUrl, setResumeUrl, onResume } = useJourneyResumeController({
    hasSuspendedCallback,
    resume,
    appendDebug,
  });

  const resolveDefaultSystemDeviceName =
    useCallback(async (): Promise<string> => {
      if (defaultSystemDeviceNameRef.current) {
        return defaultSystemDeviceNameRef.current;
      }

      try {
        const profile = await collectDeviceProfile(['platform']);
        const resolved = resolveDeviceNameFromDeviceProfile(profile);
        if (resolved) {
          defaultSystemDeviceNameRef.current = resolved;
          appendDebug('Resolved default device name from platform profile', {
            defaultDeviceName: resolved,
          });
          return resolved;
        }
      } catch (error) {
        appendDebug(
          'Failed to resolve platform profile for default device name',
          { error },
        );
      }

      defaultSystemDeviceNameRef.current = 'Device';
      return defaultSystemDeviceNameRef.current;
    }, [appendDebug]);

  useEffect(() => {
    if (!isContinueNode || !hasFidoRegistrationCallback) {
      return;
    }

    const registrationFields = form.fields.filter(
      field => field.ref.type === 'FidoRegistrationCallback',
    );
    if (registrationFields.length === 0) {
      return;
    }

    const emptyRegistrationFields = registrationFields.filter(field => {
      const value = form.values[field.id];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (emptyRegistrationFields.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const defaultDeviceName = await resolveDefaultSystemDeviceName();
      if (cancelled || defaultDeviceName.trim().length === 0) {
        return;
      }

      for (const field of emptyRegistrationFields) {
        const currentValue = form.values[field.id];
        if (
          typeof currentValue === 'string' &&
          currentValue.trim().length > 0
        ) {
          continue;
        }
        form.setValue(field.id, defaultDeviceName);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    form,
    form.fields,
    form.values,
    hasFidoRegistrationCallback,
    isContinueNode,
    resolveDefaultSystemDeviceName,
  ]);

  const runFidoIntegrations = useCallback(
    async (
      options: FidoIntegrationExecutionOptions = {},
    ): Promise<FidoIntegrationExecutionResult> => {
      const { continueOnAuthenticationCancel = false } = options;
      let authenticationCancelled = false;

      if (!isContinueNode || !hasFidoCallback) {
        return { authenticationCancelled };
      }

      const fidoFields = form.fields.filter(
        field =>
          field.ref.type === 'FidoRegistrationCallback' ||
          field.ref.type === 'FidoAuthenticationCallback',
      );

      for (const field of fidoFields) {
        if (field.ref.type === 'FidoRegistrationCallback') {
          const raw = form.values[field.id];
          const inputDeviceName = typeof raw === 'string' ? raw.trim() : '';
          const deviceName =
            inputDeviceName.length > 0
              ? inputDeviceName
              : await resolveDefaultSystemDeviceName();
          appendDebug('Journey FIDO registration requested', {
            index: field.ref.typeIndex,
            hasDeviceName: deviceName.length > 0,
            usedDefaultSystemDeviceName: inputDeviceName.length === 0,
          });
          await fido.registerForJourney(journeyClient, {
            index: field.ref.typeIndex,
            deviceName,
          });
          continue;
        }

        appendDebug('Journey FIDO authentication requested', {
          index: field.ref.typeIndex,
        });
        try {
          await fido.authenticateForJourney(journeyClient, {
            index: field.ref.typeIndex,
          });
        } catch (error) {
          if (
            continueOnAuthenticationCancel &&
            isFidoAuthenticationCancelledError(error)
          ) {
            authenticationCancelled = true;
            appendDebug('Journey FIDO authentication cancelled', {
              index: field.ref.typeIndex,
              behavior: 'continue_to_next',
            });
            continue;
          }
          throw error;
        }
      }
      return { authenticationCancelled };
    },
    [
      appendDebug,
      form.fields,
      form.values,
      hasFidoCallback,
      isContinueNode,
      journeyClient,
      fido,
      resolveDefaultSystemDeviceName,
    ],
  );

  useEffect(() => {
    if (!isContinueNode) {
      lastAutoFidoAuthNodeKeyRef.current = null;
      return;
    }

    const hasNonFidoIntegrationIssue = form.issues.some(
      issue =>
        issue.code === 'INTEGRATION_REQUIRED' &&
        issue.callbackType !== 'FidoRegistrationCallback' &&
        issue.callbackType !== 'FidoAuthenticationCallback',
    );
    const hasManualInput = form.fields.some(field => field.requiresUserInput);
    const canAutoRunFidoAuthOnly =
      !loading &&
      hasFidoAuthenticationCallback &&
      !hasFidoRegistrationCallback &&
      !hasManualInput &&
      !hasNonFidoIntegrationIssue &&
      !hasDeviceProfileCallback &&
      !hasPollingWaitCallback &&
      !hasSuspendedCallback &&
      !form.meta.hasUnsupported &&
      continueNodeKey.length > 0;

    if (!canAutoRunFidoAuthOnly) {
      return;
    }

    if (lastAutoFidoAuthNodeKeyRef.current === continueNodeKey) {
      return;
    }
    lastAutoFidoAuthNodeKeyRef.current = continueNodeKey;

    void (async () => {
      try {
        appendDebug('Journey auto FIDO authentication requested', {
          mode: 'auth-only continue node',
          continueNodeKey,
        });
        const fidoResult = await runFidoIntegrations({
          continueOnAuthenticationCancel: true,
        });
        if (fidoResult.authenticationCancelled) {
          appendDebug(
            'Journey auto-continue after cancelled FIDO authentication',
            {
              continueNodeKey,
            },
          );
        }
        await next({});
      } catch {
        // Error is reflected by the Journey hook state and debug effect.
      }
    })();
  }, [
    appendDebug,
    continueNodeKey,
    form.fields,
    form.issues,
    form.meta.hasUnsupported,
    hasDeviceProfileCallback,
    hasFidoAuthenticationCallback,
    hasFidoRegistrationCallback,
    hasPollingWaitCallback,
    hasSuspendedCallback,
    isContinueNode,
    loading,
    next,
    runFidoIntegrations,
  ]);

  useJourneyAutomationEffects({
    node,
    loading,
    journeyClient,
    formCanSubmit: form.canSubmit,
    formInput: form.input,
    continueNodeKey,
    deviceProfileRequestKey,
    hasDeviceProfileCallback,
    automationPolicy,
    next,
  });

  useJourneyDebugEffects({
    node,
    error,
    appendDebug,
  });

  const onStart = useCallback(async (): Promise<boolean> => {
    const trimmedJourneyName = journeyName.trim();
    if (!trimmedJourneyName) {
      appendDebug('Journey start skipped', {
        reason: 'Journey name is empty',
      });
      return false;
    }

    appendDebug('Journey start requested', {
      journeyName: trimmedJourneyName,
      startOptions,
    });

    try {
      await start(trimmedJourneyName, startOptions);
      form.reset();
      setResumeUrl('');
      return true;
    } catch {
      return false;
    }
  }, [appendDebug, form, journeyName, setResumeUrl, start, startOptions]);

  useJourneyAutoStartEffect({
    autoStartOnMount,
    loading,
    isSessionCheckRunning,
    hasActiveSession,
    node,
    journeyName,
    onStart,
  });

  const onSubmit = useCallback(async (): Promise<void> => {
    const nonFidoBlockingIssues = form.issues.filter(issue => {
      if (issue.code !== 'INTEGRATION_REQUIRED') {
        return true;
      }
      return (
        issue.callbackType !== 'FidoRegistrationCallback' &&
        issue.callbackType !== 'FidoAuthenticationCallback'
      );
    });

    if (nonFidoBlockingIssues.length > 0) {
      appendDebug('Journey submit blocked', {
        issues: nonFidoBlockingIssues,
      });
      return;
    }

    appendDebug('Journey submit requested', {
      callbacks: form.fields.map(field => ({
        type: field.ref.type,
        index: field.ref.typeIndex,
        value: form.values[field.id],
      })),
    });

    try {
      const fidoResult = await runFidoIntegrations({
        continueOnAuthenticationCancel: true,
      });
      if (fidoResult.authenticationCancelled) {
        appendDebug(
          'Journey submit continues after cancelled FIDO authentication',
        );
      }

      const callbacks = form.input.callbacks ?? [];
      const submitInput: JourneyNextInput = hasFidoCallback
        ? {
            callbacks: callbacks.filter(
              callback =>
                callback.type !== 'FidoRegistrationCallback' &&
                callback.type !== 'FidoAuthenticationCallback' &&
                callback.type !== 'HiddenValueCallback',
            ),
          }
        : form.input;

      appendDebug('Journey submit payload prepared', {
        originalCallbackCount: callbacks.length,
        submitCallbackCount: submitInput.callbacks?.length ?? 0,
        filteredForFido: hasFidoCallback,
      });
      await next(submitInput);
    } catch {
      // Error is reflected by the Journey hook state and debug effect.
    }
  }, [appendDebug, form, hasFidoCallback, next, runFidoIntegrations]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      await logoutUser();
    } finally {
      setHasActiveSession(false);
      setResumeUrl('');
      form.reset();
    }
  }, [form, logoutUser, setHasActiveSession, setResumeUrl]);

  const showCallbackScreen = isContinueNode;
  const showSuccessScreen = node?.type === 'SuccessNode' || hasActiveSession;

  return {
    node,
    form,
    loading,
    error,
    isSessionCheckRunning,
    debugEntries,
    clearDebugEntries,
    pollingWaitMs,
    resumeUrl,
    setResumeUrl,
    onResume,
    onSubmit,
    onLogout,
    onContinueAfterSuccess,
    showCallbackScreen,
    showSuccessScreen,
  };
}
