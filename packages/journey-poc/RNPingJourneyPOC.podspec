require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingJourneyPOC"
  s.version      = package["version"]
  s.summary      = package["description"] || "Ping Identity Journey POC TurboModule"
  s.homepage     = package["homepage"] || "https://pingidentity.com"
  s.license      = package["license"] || "MIT"

  # Must be a HASH — cannot use package["author"] directly
  s.authors      = { "Ping Identity" => "mobile@pingidentity.com" }

  s.platforms    = { :ios => "13.0" }

  # Local monorepo source
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  s.requires_arc  = true
  s.swift_version = "5.0"

  # New Architecture helper
  install_modules_dependencies(s)
end
