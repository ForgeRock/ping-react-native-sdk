# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  new_arch_enabled = ENV['RCT_NEW_ARCH_ENABLED'] == "1"

  s.name         = "RNPingLogger"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => 'MIT', :file => 'LICENSE' }
  
  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }
  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source           = { :path => "." }

  if new_arch_enabled
    s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
    s.compiler_flags = "-DRCT_NEW_ARCH_ENABLED=1"
    # Gating of codegen
    install_modules_dependencies(s)
  else
    s.source_files = "ios/RNPingLoggerClassic.mm"
    s.compiler_flags = "-DRCT_NEW_ARCH_ENABLED=0"
  end

  s.exclude_files    = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version    = ['5.0', '5.1', '6.0']
  s.requires_arc     = true

  # Native Ping SDK
  s.dependency "PingLogger"
  s.dependency "RNPingCore"

  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
