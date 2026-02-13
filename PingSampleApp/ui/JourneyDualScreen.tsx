/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { commonStyles } from '../src/styles/common';
import { loginClient, loginClient2 } from '../src/clients';
import JourneyClientPanel from './journey/JourneyClientPanel';

/**
 * Renders two independent Journey clients for side-by-side testing.
 *
 * @returns Dual Journey screen element.
 */
export default function JourneyDualScreen(): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <JourneyClientPanel
        journeyClient={loginClient}
        title="Journey Client 1"
        startOptions={{ noSession: true, forceAuth: true }}
      />
      <JourneyClientPanel
        journeyClient={loginClient2}
        title="Journey Client 2"
        startOptions={{ noSession: true, forceAuth: true }}
      />
    </ScrollView>
  );
}
