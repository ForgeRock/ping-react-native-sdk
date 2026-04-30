# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  new_arch_enabled = ENV['RCT_NEW_ARCH_ENABLED'] == "1"

  s.name         = "RNPingBinding"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => 'MIT', :file => 'LICENSE' }
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }
  s.platforms    = { :ios => "16.0" }
  s.source       = { :path => "." }

  if new_arch_enabled
    s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  else
    s.source_files = [
      "ios/RNPingBindingClassic.mm",
      "ios/RNPingBindingEventEmitterGate.mm",
      "ios/**/*.swift",
      "ios/**/*.h"
    ]
  end

  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = ['5.0', '5.1', '6.0']

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift}"
    test_spec.dependency "PingBinding", "2.0.0"
    test_spec.dependency "RNPingCore"
  end

  # Native Ping SDK dependencies
  s.dependency "PingBinding", "2.0.0"
  s.dependency "RNPingCore"

  install_modules_dependencies(s)

  if new_arch_enabled
    s.dependency "ReactCodegen"
  end
end
