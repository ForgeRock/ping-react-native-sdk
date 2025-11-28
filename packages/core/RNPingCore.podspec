require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingCore"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Core TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = package["license"] || "MIT"

  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  # Minimum iOS version
  s.platforms    = { :ios => "13.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.0"
  s.requires_arc = true

  # Native Ping SDK dependency
  s.dependency "PingStorage"
  s.dependency "PingJourney"

  # RN New Architecture helper
  install_modules_dependencies(s)
end
