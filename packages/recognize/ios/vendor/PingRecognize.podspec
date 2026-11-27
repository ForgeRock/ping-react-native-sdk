#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#

Pod::Spec.new do |s|
  s.name             = 'PingRecognize'
  s.version          = '2.2.0'
  s.summary          = 'PingOne Recognize integration for the Ping Journey SDK'
  s.description      = <<-DESC
    Vendored podspec for the PingRecognize module of ForgeRock/ping-ios-sdk.
    The upstream repository removed this podspec and ships the module through
    SwiftPM only, so this file recreates it from the 2.2.0 tag for CocoaPods
    consumers. It depends on the Keyless pod `keyless-mobile-sdk`, which is
    served by a private Cloudsmith CocoaPods source.
  DESC
  s.homepage         = 'https://www.pingidentity.com/'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = 'Ping Identity'

  s.source           = {
    :git => 'https://github.com/ForgeRock/ping-ios-sdk.git',
    :tag => s.version.to_s
  }

  # `Journey.swift` locates `PingRecognize.RecognizeCallbacks` by class name, so
  # the module name must stay `PingRecognize`.
  s.module_name      = 'PingRecognize'
  s.swift_versions   = ['6.0']
  s.ios.deployment_target = '16.0'

  base_dir = 'Recognize/Recognize'
  s.source_files = base_dir + '/**/*.swift'
  s.resource_bundles = {
    'PingRecognize' => [base_dir + '/PrivacyInfo.xcprivacy']
  }

  s.dependency 'PingJourneyPlugin', '~> 2.2.0'
  # The sources are wrapped in `#if canImport(KeylessSDK)`. The pod exposes the
  # module `KeylessSDK`, the same name the SwiftPM package uses.
  s.dependency 'keyless-mobile-sdk', '6.0.0'
end
