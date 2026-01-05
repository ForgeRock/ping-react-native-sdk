require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name             = "RNPingCore"
  s.version          = package["version"]
  s.summary          = package["description"]
  s.homepage         = package["homepage"]
  s.license          = { :type => package["license"] || "MIT", :file => "LICENSE" }
  s.author           = package["author"]

  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source           = { :path => "." }

  s.source_files     = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version    = "5.0"
  s.requires_arc     = true

  # RN New Architecture helper
  install_modules_dependencies(s)
end
