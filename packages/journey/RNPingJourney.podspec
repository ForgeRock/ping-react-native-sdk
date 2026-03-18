# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingJourney"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # Minimum iOS version
  s.platforms    = { :ios => "16.0" }
  s.source       = { :path => "." }
  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = ['5.0', '5.1', '6.0']

  s.dependency "PingJourney"
  s.dependency "PingJourneyPlugin"
  s.dependency "RNPingCore"

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift}"
    test_spec.dependency "PingJourney"
    test_spec.dependency "PingJourneyPlugin"
    test_spec.dependency "RNPingCore"
  end

  install_modules_dependencies(s)
end
