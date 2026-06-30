/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type {
  ContinueNode,
  DaVinciFormResult,
  DaVinciNormalizedCollector,
  UnsupportedDaVinciField,
} from '@ping-identity/rn-davinci';
import { commonStyles } from '../../../../src/styles/common';
import { davinciScreenStyles } from '../../../../src/styles/davinciStyles';
import AsyncActionButton from '../../../components/molecules/AsyncActionButton';
import DaVinciFieldRenderer from '../molecules/DaVinciFieldRenderer';

/**
 * Props for {@link DaVinciContinueNodePanel}.
 */
export type DaVinciContinueNodePanelProps = {
  /**
   * Active continue node returned by the bridge.
   */
  node: ContinueNode;
  /**
   * Headless form state produced by `useDaVinciForm` for the active node.
   */
  form: DaVinciFormResult;
  /**
   * True while a DaVinci action is in flight.
   */
  loading: boolean;
  /**
   * Submits the current form by calling `next` with the planned payload.
   */
  onSubmit: () => void;
  /**
   * Submits a flow collector (`SUBMIT_BUTTON`, `ACTION`, `FLOW_BUTTON`,
   * `FLOW_LINK`) by key.
   *
   * @param flowKey Flow collector key.
   */
  onFlowAction: (flowKey: string) => void;
};

/**
 * Determines whether a collector list already contains a control that submits.
 *
 * @param collectors Normalised collectors for the current node.
 * @returns True when at least one submit or flow collector is present.
 */
function hasInteractiveSubmit(
  collectors: DaVinciNormalizedCollector[],
): boolean {
  return collectors.some(
    collector =>
      collector.type === 'SUBMIT_BUTTON' ||
      collector.type === 'ACTION' ||
      collector.type === 'FLOW_BUTTON' ||
      collector.type === 'FLOW_LINK',
  );
}

/**
 * Renders an unsupported-fields warning when the bridge dropped one or more
 * server-side fields.
 *
 * @param fields Fields the bridge could not instantiate.
 * @returns Warning element, or `null` when nothing to show.
 */
function renderUnsupportedFieldsNotice(
  fields: UnsupportedDaVinciField[] | undefined,
): React.ReactElement | null {
  if (!fields || fields.length === 0) {
    return null;
  }
  return (
    <View style={davinciScreenStyles.errorCard}>
      <Text style={davinciScreenStyles.errorCardTitle}>
        Unsupported fields skipped
      </Text>
      <Text style={davinciScreenStyles.errorCardMessage}>
        {fields.map(field => `${field.key} (${field.type})`).join(', ')}
      </Text>
    </View>
  );
}

/**
 * Renders an active DaVinci {@link ContinueNode} as a vertical form.
 *
 * @remarks
 * Each collector is dispatched to its dedicated molecule via
 * {@link DaVinciFieldRenderer}. A trailing fallback submit button is rendered
 * only when the node lacks any other interactive submit control.
 *
 * @param props Component props.
 * @returns Continue node form element.
 */
export default function DaVinciContinueNodePanel(
  props: DaVinciContinueNodePanelProps,
): React.ReactElement {
  const { node, form, loading, onSubmit, onFlowAction } = props;
  const { fields, values, canSubmit, issues, setValue } = form;

  const showFallbackSubmit = useMemo(
    () => !hasInteractiveSubmit(fields),
    [fields],
  );

  return (
    <View>
      {renderUnsupportedFieldsNotice(node.unsupportedFields)}

      {fields.map(collector => (
        <DaVinciFieldRenderer
          key={collector.key}
          collector={collector}
          value={values[collector.key]}
          onChange={next => setValue(collector.key, next)}
          onSubmit={onSubmit}
          onFlowAction={onFlowAction}
          loading={loading}
          canSubmit={canSubmit}
        />
      ))}

      {showFallbackSubmit ? (
        <AsyncActionButton
          label="Next"
          onPress={onSubmit}
          loading={loading}
          disabled={!canSubmit}
        />
      ) : null}

      {issues.length > 0 && !canSubmit ? (
        <Text style={commonStyles.textError}>
          Please complete required fields before continuing.
        </Text>
      ) : null}
    </View>
  );
}
