/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { commonStyles } from '../src/styles/common';
import JourneyClientPanel from './journey/JourneyClientPanel';

type JourneyRouteProp = RouteProp<RootStackParamList, 'Journey'>;

/**
 * Renders a single Journey panel bound to the route-selected Journey client.
 *
 * @returns Journey screen element.
 */
export default function JourneyScreen(): React.ReactElement {
  const route = useRoute<JourneyRouteProp>();
  const { journeyClient } = route.params;

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <JourneyClientPanel journeyClient={journeyClient} />
    </ScrollView>
  );
}
