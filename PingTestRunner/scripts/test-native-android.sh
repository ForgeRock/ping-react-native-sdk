#!/bin/sh
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#
# Runs all native Android unit tests.
set -e
cd "$(dirname "$0")/../android"
./gradlew \
  :ping-identity_rn-binding:test \
  :ping-identity_rn-browser:test \
  :ping-identity_rn-core:test \
  :ping-identity_rn-device-client:test \
  :ping-identity_rn-device-id:test \
  :ping-identity_rn-device-profile:test \
  :ping-identity_rn-fido:test \
  :ping-identity_rn-journey:test \
  :ping-identity_rn-logger:test \
  :ping-identity_rn-oidc:test \
  :ping-identity_rn-storage:test
