/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import type { PushClient } from '@ping-identity/rn-push';
import { commonStyles } from '../../src/styles/common';
import { colors } from '../../src/styles/colors';

type Props = {
  pushClient: PushClient;
  /** Called after a `pushauth://` URI is successfully registered via `addCredentialFromUri`. */
  onSuccess: () => void;
  /** Called when the user taps Cancel or denies camera permission. */
  onCancel: () => void;
};

/**
 * Full-screen camera view for enrolling a push credential from a `pushauth://` QR code.
 *
 * Handles camera permission requests, debounces repeated scans via `processingRef`,
 * and shows a retry/cancel alert on enrollment failure.
 */
export default function QrScannerScreen({
  pushClient,
  onSuccess,
  onCancel,
}: Props) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [scanning, setScanning] = useState(true);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      async codes => {
        const uri = codes[0]?.value;
        if (!uri || !scanning || processingRef.current) return;
        if (!uri.startsWith('pushauth://')) return;

        processingRef.current = true;
        setScanning(false);

        try {
          await pushClient.addCredentialFromUri(uri);
          onSuccess();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          Alert.alert('Enrollment Failed', message, [
            {
              text: 'Try Again',
              onPress: () => {
                processingRef.current = false;
                setScanning(true);
              },
            },
            { text: 'Cancel', onPress: onCancel },
          ]);
        }
      },
      [pushClient, scanning, onSuccess, onCancel],
    ),
  });

  if (!hasPermission) {
    return (
      <View style={commonStyles.container}>
        <Text style={commonStyles.textError}>
          Camera permission is required to scan QR codes.
        </Text>
        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={requestPermission}
        >
          <Text style={commonStyles.buttonTextSecondary}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={onCancel}
        >
          <Text style={commonStyles.buttonTextSecondary}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={commonStyles.container}>
        <Text style={commonStyles.textError}>No camera available.</Text>
        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={onCancel}
        >
          <Text style={commonStyles.buttonTextSecondary}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanning}
        codeScanner={codeScanner}
      />
      <View style={styles.overlay}>
        <Text style={styles.instructions}>
          Point the camera at the pushauth:// QR code
        </Text>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  overlay: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  instructions: {
    color: colors.white,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.white,
  },
  cancelText: {
    color: colors.white,
    fontSize: 16,
  },
});
