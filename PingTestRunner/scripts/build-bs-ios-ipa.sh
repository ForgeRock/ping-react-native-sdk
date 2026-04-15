#!/bin/sh
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#

set -eu

ARCHIVE_PATH=${BS_IOS_ARCHIVE_PATH:-ios/build/browserstack/PingTestRunner.xcarchive}
EXPORT_PATH=${BS_IOS_EXPORT_PATH:-ios/build/browserstack/export}
EXPORT_OPTIONS_PLIST=${BS_IOS_EXPORT_OPTIONS_PLIST:?Set BS_IOS_EXPORT_OPTIONS_PLIST to an exportOptions.plist path}

xcodebuild -exportArchive -archivePath "$ARCHIVE_PATH" -exportPath "$EXPORT_PATH" -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
