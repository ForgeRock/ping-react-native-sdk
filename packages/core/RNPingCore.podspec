# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingCore"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => 'MIT', :file => 'LICENSE' }

  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }

  # Minimum iOS version
  s.platforms    = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source       = { :path => "." }
  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = "ios/Tests/**/*"
  s.swift_version = ['5.0', '5.1', '6.0']

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift}"
  end

  install_modules_dependencies(s)
end
