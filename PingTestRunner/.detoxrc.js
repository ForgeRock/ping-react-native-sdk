/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** @type {Detox.DetoxConfig} */
module.exports = {
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
    },
    // BrowserStack cloud app — URLs are resolved after uploading binaries to BrowserStack.
    'android.cloud': {
      type: 'android.cloud',
      app: process.env.BROWSERSTACK_APP_URL,
      appClient: process.env.BROWSERSTACK_TEST_URL,
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
    // BrowserStack real device — override via env vars to target a different device.
    browserstack: {
      type: 'android.cloud',
      device: {
        name: process.env.BROWSERSTACK_DEVICE ?? 'Google Pixel 9',
        osVersion: process.env.BROWSERSTACK_OS_VERSION ?? '15.0',
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
    // BrowserStack real-device configuration.
    'android.bs': {
      device: 'browserstack',
      app: 'android.cloud',
      // cloudAuthentication and session must live inside the configuration
      // entry — the BrowserStack detox fork reads localConfig, not the
      // top-level config, for these cloud-specific properties.
      cloudAuthentication: {
        username: process.env.BROWSERSTACK_USERNAME,
        accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
      },
      session: {
        server: 'wss://detox.browserstack.com/init',
        name: process.env.BROWSERSTACK_SESSION_NAME,
        build: process.env.BROWSERSTACK_BUILD_ID,
        project: process.env.BROWSERSTACK_PROJECT_NAME,
        local: false,
      },
    },
  },
};
