require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingJourney"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}" ## add swift files
  s.swift_version = "5.0" # add swift version
  s.private_header_files = "ios/**/*.h"
  s.requires_arc  = true

  s.dependency "PingJourney" ## Only for POC. Should include version in real world

  install_modules_dependencies(s)
end
