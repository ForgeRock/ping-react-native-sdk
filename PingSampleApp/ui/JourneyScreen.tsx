/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { commonStyles } from '../src/styles/common';
import { loginClient } from '../src/clients';
import JourneyClientPanel from './journey/components/JourneyClientPanel';

/**
 * Renders the advanced Journey sample panel with callback renderer coverage.
 *
 * @returns Journey screen element.
 */
export default function JourneyScreen(): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <JourneyClientPanel journeyClient={loginClient} />
    </ScrollView>
  );
}
