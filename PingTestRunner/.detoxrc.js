/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** @type {Detox.DetoxConfig} */
const detoxPort = Number(process.env.DETOX_SERVER_PORT ?? 8099);

module.exports = {
  session: {
    server: `ws://127.0.0.1:${detoxPort}`,
    autoStart: true,
  },
  server: {
    port: detoxPort,
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      screenshot: 'failing',
      video: 'failing',
    },
  },
  behavior: {
    cleanup: {
      shutdownDevice: false,
    },
  },
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 300000,
    },
  },
  apps: {
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/PingTestRunner.app',
      build:
        'xcodebuild -workspace ios/PingTestRunner.xcworkspace -scheme PingTestRunner -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
      reversePorts: [detoxPort],
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_9',
      },
    },
  },
  configurations: {
    'ios.sim': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
