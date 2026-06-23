/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useEffect, useRef } from 'react';
import type { DaVinciNode } from '@ping-identity/rn-davinci';

/**
 * Configuration contract for `useDaVinciAutoStartEffect`.
 */
export type UseDaVinciAutoStartEffectOptions = {
  /** Current loading state. */
  loading: boolean;
  /** Session bootstrap running state. */
  isSessionCheckRunning: boolean;
  /** Current authenticated session state. */
  hasActiveSession: boolean;
  /** Active DaVinci node. */
  node: DaVinciNode | null;
  /** Start action returning a success indicator. */
  onStart: () => Promise<boolean>;
};

/**
 * Auto-starts the DaVinci flow once when no node and no active session are
 * present, mirroring the Journey panel auto-start gating.
 *
 * @param options - Auto-start effect options.
 */
export function useDaVinciAutoStartEffect(
  options: UseDaVinciAutoStartEffectOptions,
): void {
  const { loading, isSessionCheckRunning, hasActiveSession, node, onStart } =
    options;
  const hasAutoStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    if (node) return;
    if (loading || isSessionCheckRunning || hasActiveSession) return;

    hasAutoStartedRef.current = true;
    void (async () => {
      const didStart = await onStart();
      if (!didStart) {
        hasAutoStartedRef.current = false;
      }
    })();
  }, [hasActiveSession, isSessionCheckRunning, loading, node, onStart]);
}
