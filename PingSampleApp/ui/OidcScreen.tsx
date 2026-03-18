/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import type { OidcClientConfig } from '@ping-identity/rn-oidc';
import { commonStyles } from '../src/styles/common';
import { sampleOidcClientConfig } from '../src/clients';
import OidcClientPanel from './oidc/components/organisms/OidcClientPanel';

/**
 * Renders OIDC helper screen with provider-backed state.
 *
 * @returns OIDC screen element.
 */
export default function OidcScreen(): React.ReactElement {
  const clientConfig = useMemo<OidcClientConfig>(() => sampleOidcClientConfig, []);

  return (
    <ScrollView contentContainerStyle={commonStyles.container} nestedScrollEnabled>
      <OidcClientPanel clientConfig={clientConfig} />
    </ScrollView>
  );
}
