/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** @type {Detox.DetoxConfig} */
const detoxPort = Number(process.env.DETOX_SERVER_PORT ?? 8099)
const isBrowserStack = Boolean(process.env.BROWSERSTACK_USERNAME)

module.exports = {
  session: isBrowserStack
    ? {
        // BrowserStack WebSocket hub — required for android.cloud device type.
        server: 'wss://hub-cloud.browserstack.com/detox',
        project: process.env.BROWSERSTACK_PROJECT_NAME,
        // Build on PR: pr-<PR_NUMBER>-<SHORT_SHA> 
        build: process.env.BROWSERSTACK_BUILD_ID,
        // Session: <platform>-<framework>-<test_name>  
        name: process.env.BROWSERSTACK_SESSION_NAME,
        local: false,
      }
    : {
        server: `ws://127.0.0.1:${detoxPort}`,
        autoStart: true,
      },
  // BrowserStack credentials — read from environment variables, never hardcoded.
  cloudAuthentication: {
    username: process.env.BROWSERSTACK_USERNAME,
    accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
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
    },
  },
};
