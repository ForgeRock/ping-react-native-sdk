# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingOidc"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }
  s.source       = { :git => "https://github.com/pingidentity-gaurav/ping-identity-rn-oidc.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = ['5.0', '5.1', '6.0']

  s.dependency 'PingOidc', '1.3.1'
  s.dependency 'RNPingCore'
  s.dependency 'RNPingLogger'
  s.dependency 'RNPingStorage'

  install_modules_dependencies(s)
end
