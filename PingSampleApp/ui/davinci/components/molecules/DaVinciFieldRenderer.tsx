/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { memo } from 'react';
import DaVinciDeviceField from './DaVinciDeviceField';
import DaVinciFlowButton from './DaVinciFlowButton';
import DaVinciIdpField from './DaVinciIdpField';
import DaVinciLabelField from './DaVinciLabelField';
import DaVinciMultiSelectField from './DaVinciMultiSelectField';
import DaVinciPasswordField from './DaVinciPasswordField';
import DaVinciPhoneNumberField from './DaVinciPhoneNumberField';
import DaVinciSingleSelectField from './DaVinciSingleSelectField';
import DaVinciSubmitButton from './DaVinciSubmitButton';
import DaVinciTextField from './DaVinciTextField';
import DaVinciUnsupportedField from './DaVinciUnsupportedField';
import type { DaVinciCollectorRendererProps } from './types';

/**
 * Routes a normalised DaVinci collector to the appropriate molecule.
 *
 * @param props Renderer props.
 * @returns Field element, or `null` when the collector should be hidden.
 */
function DaVinciFieldRenderer(
  props: DaVinciCollectorRendererProps,
): React.ReactElement | null {
  const { collector } = props;

  switch (collector.type) {
    case 'TEXT':
      return <DaVinciTextField {...props} />;
    case 'PASSWORD':
    case 'PASSWORD_VERIFY':
      return <DaVinciPasswordField {...props} />;
    case 'SUBMIT_BUTTON':
      return <DaVinciSubmitButton {...props} />;
    case 'ACTION':
    case 'FLOW_BUTTON':
    case 'FLOW_LINK':
      return <DaVinciFlowButton {...props} />;
    case 'LABEL':
      return <DaVinciLabelField {...props} />;
    case 'SINGLE_SELECT':
    case 'DROPDOWN':
    case 'RADIO':
      return <DaVinciSingleSelectField {...props} />;
    case 'MULTI_SELECT':
    case 'COMBOBOX':
    case 'CHECKBOX':
      return <DaVinciMultiSelectField {...props} />;
    case 'PHONE_NUMBER':
      return <DaVinciPhoneNumberField {...props} />;
    case 'DEVICE_REGISTRATION':
    case 'DEVICE_AUTHENTICATION':
      return <DaVinciDeviceField {...props} />;
    case 'SOCIAL_LOGIN_BUTTON':
      return (
        <DaVinciIdpField {...props} onIdpAuthorize={props.onIdpAuthorize} />
      );
    default:
      return <DaVinciUnsupportedField {...props} />;
  }
}

export default memo(DaVinciFieldRenderer);
