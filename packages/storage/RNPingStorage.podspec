require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingStorage"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Storage TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = package["license"] || "MIT"

  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  # Minimum iOS version
  s.platforms    = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source       = { :path => "." }

  if ENV['RCT_NEW_ARCH_ENABLED'] == "1"
    s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  else
    s.source_files = "ios/RNPingStorageClassic.mm"
  end

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.0"
  s.requires_arc = true

  # Native Ping SDK dependency (internal iOS SDK)
  s.dependency "PingStorage"
  s.dependency "RNPingCore"

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift,m,mm}"
    test_spec.dependency "PingStorage"
    test_spec.dependency "RNPingCore"
  end


  # Compiler flag toggle
  if ENV['RCT_NEW_ARCH_ENABLED'] == "1"
    s.compiler_flags = "-DRCT_NEW_ARCH_ENABLED=1"
  else
    s.compiler_flags = "-DRCT_NEW_ARCH_ENABLED=0"
  end

  # Gating of codegen
  if ENV['RCT_NEW_ARCH_ENABLED'] == "1"
    install_modules_dependencies(s)
  end
end
