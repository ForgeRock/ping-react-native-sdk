require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingBrowser"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Browser TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = package["license"] || "MIT"

  # Must be a HASH — cannot use package["author"] directly
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  s.platforms    = { :ios => "16.0" }

  # Local monorepo source
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.exclude_files = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.0"
  s.requires_arc = true

  # Native Ping SDK dependency
  s.dependency "PingBrowser", "1.3.0-beta2"

  # New Architecture helper
  install_modules_dependencies(s)
  
  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
