/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { memo } from 'react';
import JourneyBooleanField from './JourneyBooleanField';
import JourneyChoiceField from './JourneyChoiceField';
import JourneyKbaField from './JourneyKbaField';
import JourneyOutputField from './JourneyOutputField';
import JourneyTextField from './JourneyTextField';
import JourneyUnsupportedField from './JourneyUnsupportedField';
import type { JourneyFieldRendererProps } from './types';

/**
 * Routes a normalized Journey field to the appropriate UI renderer component.
 *
 * @param props - Field renderer props.
 * @returns Field element.
 */
function JourneyFieldRenderer(
  props: JourneyFieldRendererProps,
): React.ReactElement | null {
  const { field } = props;
  const isFidoRegistrationCallback =
    field.ref.type === 'FidoRegistrationCallback';
  const isFidoAuthenticationCallback =
    field.ref.type === 'FidoAuthenticationCallback';

  if (field.ref.type === 'HiddenValueCallback') {
    return null;
  }

  if (isFidoAuthenticationCallback) {
    return null;
  }

  if (isFidoRegistrationCallback) {
    return <JourneyTextField {...props} />;
  }

  if (field.executionMode === 'output_only') {
    return <JourneyOutputField {...props} />;
  }

  if (
    field.executionMode === 'integration_required' ||
    field.executionMode === 'unsupported'
  ) {
    return <JourneyUnsupportedField {...props} />;
  }

  if (field.kind === 'boolean') {
    return <JourneyBooleanField {...props} />;
  }

  if (field.kind === 'choice') {
    return <JourneyChoiceField {...props} />;
  }

  if (field.kind === 'kba') {
    return <JourneyKbaField {...props} />;
  }

  return <JourneyTextField {...props} />;
}

export default memo(JourneyFieldRenderer);
