require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingDeviceProfile"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => package["license"] || "MIT", :file => "LICENSE" }
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }

  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source           = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.exclude_files    = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version    = ['5.0', '5.1']
  s.requires_arc     = true

  # Native Ping SDK dependency
  s.dependency "PingDeviceProfile"
  s.dependency "RNPingCore"

  # New Architecture helper
  install_modules_dependencies(s)
  
  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
