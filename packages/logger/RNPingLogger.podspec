require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPingLogger"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => package["license"] || "MIT", :file => "LICENSE" }
  s.authors      = package["author"]

  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source           = { :path => "." }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.exclude_files    = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version    = "5.0"
  s.requires_arc     = true

  # Native Ping SDK
  s.dependency "PingLogger"
  s.dependency "RNPingCore"

  # New Architecture helper
  install_modules_dependencies(s)
  
  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
