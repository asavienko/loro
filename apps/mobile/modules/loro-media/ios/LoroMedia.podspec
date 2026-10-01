Pod::Spec.new do |s|
  s.name = 'LoroMedia'
  s.version = '0.1.0'
  s.summary = 'The one player on the lock screen and in Control Center, with its grades.'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Loro'
  s.homepage = 'https://loro.app'
  s.source = { :git => 'https://github.com/asavienko/loro.git' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer'
  s.source_files = 'LoroMediaModule.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
