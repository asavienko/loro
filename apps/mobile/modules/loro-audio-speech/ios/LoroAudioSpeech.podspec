Pod::Spec.new do |s|
  s.name           = 'LoroAudioSpeech'
  s.version        = '0.0.1'
  s.summary        = 'Device speech playback and strictly on-device recognition for Loro.'
  s.description    = 'Local Expo module; recorded buffers remain in native memory.'
  s.author         = 'Loro'
  s.homepage       = 'https://github.com/asavienko/loro'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/asavienko/loro.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'AVFoundation', 'Speech', 'UIKit'
  s.swift_version  = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = '**/*.{h,m,mm,swift}'
end
