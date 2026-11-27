# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingRecognize"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => 'MIT', :file => 'LICENSE' }

  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }

  # Minimum iOS version (PingRecognize requires iOS 16)
  s.platforms    = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source       = { :path => "." }

  # New architecture only (proof of concept): no classic bridge entry point.
  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = ["ios/Tests/**/*", "ios/vendor/**/*"]
  s.private_header_files = "ios/**/*.h"
  s.swift_version = ['5.0', '5.1', '6.0']

  # Native Ping SDK dependency. PingRecognize is not published to CocoaPods
  # trunk; the host Podfile resolves it through the vendored podspec in
  # ios/vendor/PingRecognize.podspec (see ios/DELIVERY.md).
  s.dependency "PingRecognize", '2.2.0'
  s.dependency "RNPingCore"

  install_modules_dependencies(s)

  s.dependency "ReactCodegen"
end
