/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import EmptyStateCard from '../../../components/molecules/EmptyStateCard';

/**
 * Renders the DaVinci user profile placeholder tab body.
 *
 * @returns DaVinci profile panel element.
 */
export default function UserProfileDaVinciPanel(): React.ReactElement {
  return (
    <EmptyStateCard
      title="DaVinci Session"
      message="DaVinci user profile integration is not available in this sample yet."
    />
  );
}
