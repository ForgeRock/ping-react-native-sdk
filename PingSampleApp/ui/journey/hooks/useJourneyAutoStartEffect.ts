/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useEffect, useRef } from 'react';
import type { JourneyNode } from '@ping-identity/rn-journey';

/**
 * Configuration contract for `useJourneyAutoStartEffect`.
 */
export type UseJourneyAutoStartEffectOptions = {
  /**
   * Enables or disables auto-start behavior.
   */
  autoStartOnMount: boolean;
  /**
   * Current loading state.
   */
  loading: boolean;
  /**
   * Session bootstrap running state.
   */
  isSessionCheckRunning: boolean;
  /**
   * Current authenticated session state.
   */
  hasActiveSession: boolean;
  /**
   * Active Journey node.
   */
  node: JourneyNode | null;
  /**
   * Current editable journey name value.
   */
  journeyName: string;
  /**
   * Start action returning success indicator.
   */
  onStart: () => Promise<boolean>;
};

/**
 * Runs sample-app auto-start behavior when configured and eligible.
 *
 * @param options - Auto-start effect options.
 * @returns Void.
 */
export function useJourneyAutoStartEffect(options: UseJourneyAutoStartEffectOptions): void {
  const {
    autoStartOnMount,
    loading,
    isSessionCheckRunning,
    hasActiveSession,
    node,
    journeyName,
    onStart,
  } = options;
  const hasAutoStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!autoStartOnMount) {
      return;
    }
    if (hasAutoStartedRef.current) {
      return;
    }
    if (loading || isSessionCheckRunning || hasActiveSession || node) {
      return;
    }
    if (!journeyName.trim()) {
      return;
    }

    hasAutoStartedRef.current = true;
    const runAutoStart = async (): Promise<void> => {
      const didStart = await onStart();
      if (!didStart) {
        hasAutoStartedRef.current = false;
      }
    };

    void runAutoStart();
  }, [
    autoStartOnMount,
    hasActiveSession,
    isSessionCheckRunning,
    journeyName,
    loading,
    node,
    onStart,
  ]);
}
