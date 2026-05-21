#!/bin/sh
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#
# Runs all native iOS unit tests.
set -e
WORKSPACE="$(dirname "$0")/../ios/PingTestRunner.xcworkspace"
DESTINATION="platform=iOS Simulator,name=iPhone 16,OS=18.6"

run_scheme() {
  xcodebuild test -workspace "$WORKSPACE" -scheme "$1" -destination "$DESTINATION"
}

run_scheme RNPingBinding-Unit-Tests
run_scheme RNPingBrowser-Unit-Tests
run_scheme RNPingCore-Unit-Tests
run_scheme RNPingDeviceClient-Unit-Tests
run_scheme RNPingDeviceId-Unit-Tests
run_scheme RNPingDeviceProfile-Unit-Tests
run_scheme RNPingExternalIdp-Unit-Tests
run_scheme RNPingFido-Unit-Tests
run_scheme RNPingJourney-Unit-Tests
run_scheme RNPingLogger-Unit-Tests
run_scheme RNPingOidc-Unit-Tests
run_scheme RNPingPush-Unit-Tests
run_scheme RNPingStorage-Unit-Tests
