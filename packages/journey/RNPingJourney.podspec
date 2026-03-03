require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingJourney"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Journey TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = { :type => 'MIT', :file => 'LICENSE' }

  # Must be a HASH — cannot use package["author"] directly
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  s.platforms    = { :ios => "16.0" }

  # Local monorepo source
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  s.requires_arc  = true
  s.swift_version = "5.0"

  # Native Ping SDK (POC)
  s.dependency "PingJourney"
  s.dependency "RNPingCore"

  # New Architecture helper
  install_modules_dependencies(s)
end
