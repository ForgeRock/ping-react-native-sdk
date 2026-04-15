#!/bin/sh
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#

set -eu

ARCHIVE_PATH=${BS_IOS_ARCHIVE_PATH:-ios/build/browserstack/PingTestRunner.xcarchive}
EXTRA_XCODEBUILD_ARGS=${BS_IOS_ARCHIVE_XCODEBUILD_ARGS:-}

xcodebuild -workspace ios/PingTestRunner.xcworkspace -scheme PingTestRunner -configuration Release -destination generic/platform=iOS -archivePath "$ARCHIVE_PATH" $EXTRA_XCODEBUILD_ARGS archive
