/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  DaVinciFormValue,
  DaVinciNormalizedCollector,
} from '@ping-identity/rn-davinci';

/**
 * Shared props for every DaVinci collector renderer.
 */
export type DaVinciCollectorRendererProps = {
  /**
   * Normalised DaVinci collector to render.
   */
  collector: DaVinciNormalizedCollector;
  /**
   * Current form value for this collector, when present.
   */
  value: DaVinciFormValue | undefined;
  /**
   * Updates the form value for this collector.
   *
   * @param value Next collector value.
   */
  onChange: (value: DaVinciFormValue) => void;
  /**
   * Submits the current form. Used by submit buttons and flow links.
   */
  onSubmit: () => void;
  /**
   * Immediately advances the flow using a specific {@link FlowCollector} key.
   *
   * @param flowKey Flow collector key to submit.
   */
  onFlowAction: (flowKey: string) => void;
  /**
   * Whether the form is currently in a submission state.
   */
  loading: boolean;
  /**
   * Whether the form can currently be submitted.
   */
  canSubmit: boolean;
};
