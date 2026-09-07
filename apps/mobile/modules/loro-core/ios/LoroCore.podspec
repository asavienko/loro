Pod::Spec.new do |s|
  s.name = 'LoroCore'
  s.version = '0.1.0'
  s.summary = 'Canonical offline Loro algorithms'
  s.description = 'Synchronous Expo transport into the generated Rust UniFFI bindings.'
  s.author = 'Loro'
  s.homepage = 'https://github.com/loro'
  s.license = { :type => 'UNLICENSED' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift', '../../../../../packages/core-rs/bindings/*.swift'
  s.vendored_frameworks = '../artifacts/LoroCoreFFI.xcframework'
  s.swift_version = '5.9'
end
