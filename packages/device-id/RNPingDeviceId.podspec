require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingDeviceId"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Journey TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = package["license"] || "MIT"

  # Must be a HASH — cannot use package["author"] directly
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  min_ios_version_supported = "16.0"

  s.platforms    = { :ios => "16.0" }

  # Local monorepo source
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.requires_arc  = true
  s.swift_version = "5.0"

  # Native Ping SDK 
  s.dependency "PingDeviceId"
  s.dependency "RNPingCore"

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift}"
    test_spec.dependency "RNPingCore"
  end

  # New Architecture helper
  install_modules_dependencies(s)
end
