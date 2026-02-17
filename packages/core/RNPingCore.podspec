require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name             = "RNPingCore"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => 'MIT', :file => 'LICENSE' }
  
  # CocoaPods requires this to be a hash
  s.authors      = { "Ping Identity" => "sdk@pingidentity.com" }
  # Minimum iOS version
  s.platforms        = { :ios => "16.0" }

  # IMPORTANT: local monorepo source path (not git)
  s.source           = { :path => "." }

  if ENV['RCT_NEW_ARCH_ENABLED'] == "1"
    s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  else
    s.source_files = "ios/RNPingCoreClassic.mm"
  end

  s.source_files     = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files    = "ios/Tests/**/*"
  s.private_header_files = "ios/**/*.h"
  s.swift_version    = "5.0"
  s.requires_arc     = true

  s.test_spec "Tests" do |test_spec|
    test_spec.source_files = "ios/Tests/**/*.{swift}"
  end

  # Native Ping SDK dependency
  s.dependency "PingJourney"

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
  
  # Explicitly add ReactCodegen dependency for generated specs
  s.dependency "ReactCodegen"
end
