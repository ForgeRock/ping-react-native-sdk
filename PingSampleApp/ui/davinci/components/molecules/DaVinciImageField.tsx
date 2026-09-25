/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Image, Linking, Text, View } from 'react-native';
import type { ImageCollector } from '@ping-identity/rn-davinci';
import { colors } from '../../../../src/styles/colors';
import { davinciFieldStyles } from '../../../../src/styles/davinciStyles';
import type { DaVinciCollectorRendererProps } from './types';

/**
 * Renders an {@link ImageCollector} as a display-only image with an optional
 * tappable hyperlink.
 *
 * @remarks
 * Sample-app-layer rendering only: the SDK surfaces `imageUrl`, `description`,
 * and `hyperlinkUrl` as received and never downloads, caches, renders, or
 * opens these URLs. Follows the single-fallback pattern of
 * `DaVinciQrCodeField`: the description shows as a caption under the image
 * when the image renders, and alone when the image failed to load or the URL
 * is empty. The hyperlink, when present, opens via `Linking` on tap.
 *
 * @param props Renderer props.
 * @returns Image field element.
 */
export default function DaVinciImageField(
  props: DaVinciCollectorRendererProps,
): React.ReactElement {
  const { collector } = props;
  const imageCollector = collector as ImageCollector;
  const [failed, setFailed] = React.useState(false);

  // A reused component instance must retry the new image, so clear a stale
  // load failure whenever the collector presents a different URL.
  React.useEffect(() => {
    setFailed(false);
  }, [imageCollector.imageUrl]);

  const openHyperlink = (): void => {
    const hyperlinkUrl = imageCollector.hyperlinkUrl;
    // Only http(s) URLs are opened; other schemes are ignored.
    if (hyperlinkUrl && /^https?:\/\//i.test(hyperlinkUrl)) {
      Linking.openURL(hyperlinkUrl).catch(() => {});
    }
  };

  return (
    <View style={davinciFieldStyles.card}>
      {!failed && imageCollector.imageUrl ? (
        <>
          <Image
            source={{ uri: imageCollector.imageUrl }}
            style={davinciFieldStyles.image}
            onError={() => setFailed(true)}
            accessibilityLabel={imageCollector.description}
          />
          <Text style={davinciFieldStyles.imageCaption}>
            {imageCollector.description}
          </Text>
        </>
      ) : (
        <Text style={davinciFieldStyles.imageCaption}>
          {imageCollector.description}
        </Text>
      )}
      {imageCollector.hyperlinkUrl ? (
        <Text
          style={linkStyle}
          onPress={openHyperlink}
          accessibilityRole="link"
          accessibilityLabel={imageCollector.hyperlinkUrl}
        >
          {imageCollector.hyperlinkUrl}
        </Text>
      ) : null}
    </View>
  );
}

const linkStyle = {
  color: colors.primary,
  textDecorationLine: 'underline' as const,
};
