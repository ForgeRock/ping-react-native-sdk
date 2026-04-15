#!/bin/sh
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#

set -eu

DERIVED_DATA_PATH=${BS_IOS_DERIVED_DATA_PATH:-ios/build/browserstack-derived-data}
EXTRA_XCODEBUILD_ARGS=${BS_IOS_TEST_SUITE_XCODEBUILD_ARGS:-}
SIGNING_ARGS=""

if [ -n "${BS_IOS_TEAM_ID:-}" ]; then
  SIGNING_ARGS="$SIGNING_ARGS DEVELOPMENT_TEAM=${BS_IOS_TEAM_ID}"
fi

if [ -n "${BS_IOS_APP_PROFILE_UUID:-}" ] || [ -n "${BS_IOS_UI_TEST_PROFILE_UUID:-}" ]; then
  SIGNING_ARGS="$SIGNING_ARGS CODE_SIGN_STYLE=Manual"
fi

if [ -n "${BS_IOS_APP_PROFILE_UUID:-}" ]; then
  SIGNING_ARGS="$SIGNING_ARGS APP_PROVISIONING_PROFILE_UUID=${BS_IOS_APP_PROFILE_UUID}"
fi

if [ -n "${BS_IOS_UI_TEST_PROFILE_UUID:-}" ]; then
  SIGNING_ARGS="$SIGNING_ARGS UI_TEST_PROVISIONING_PROFILE_UUID=${BS_IOS_UI_TEST_PROFILE_UUID}"
fi

xcodebuild -workspace ios/PingTestRunner.xcworkspace -scheme PingTestRunner -configuration Debug -sdk iphoneos -destination generic/platform=iOS -derivedDataPath "$DERIVED_DATA_PATH" $SIGNING_ARGS $EXTRA_XCODEBUILD_ARGS build-for-testing

cd "$DERIVED_DATA_PATH/Build/Products/Debug-iphoneos"
rm -f PingTestRunnerUITests-Runner.zip
zip --symlinks -r PingTestRunnerUITests-Runner.zip PingTestRunnerUITests-Runner.app
