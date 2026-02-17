# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingBrowser"
  s.version      = package["version"]
  s.summary      = package["description"] 
  s.homepage     = package["homepage"] 
  s.license      = package["license"] 

  # Must be a HASH — cannot use package["author"] directly
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }

  s.platforms    = { :ios => "16.0" }

  # Local monorepo source
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = ['5.0', '5.1']
  s.requires_arc = true

  s.dependency 'PingBrowser', '1.3.1'
  s.dependency 'RNPingCore'

  # New Architecture helper
  install_modules_dependencies(s)
  
  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
