/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import TokenOutputCard from '../molecules/TokenOutputCard';

/**
 * Props for the DaVinci token panel.
 */
type TokenDaVinciPanelProps = {
  /**
   * Current token/session payload text.
   */
  tokenOutput: string;
};

/**
 * Renders DaVinci token output.
 *
 * @param props - DaVinci token panel props.
 * @returns DaVinci token panel element.
 */
export default function TokenDaVinciPanel(props: TokenDaVinciPanelProps): React.ReactElement {
  const { tokenOutput } = props;

  return <TokenOutputCard tokenOutput={tokenOutput} showComingSoonBadge />;
}
