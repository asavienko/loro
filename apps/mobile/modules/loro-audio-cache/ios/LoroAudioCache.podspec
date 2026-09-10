Pod::Spec.new do |s|
  s.name           = 'LoroAudioCache'
  s.version        = '0.0.1'
  s.summary        = 'Atomic model-audio cache download for Loro listening clips.'
  s.description    = 'Downloads licensed TTS files to disk and returns file URIs only.'
  s.author         = 'Loro'
  s.homepage       = 'https://github.com/asavienko/loro'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/asavienko/loro.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'AVFoundation', 'CryptoKit'
  s.swift_version  = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = '**/*.{h,m,mm,swift}'
end
