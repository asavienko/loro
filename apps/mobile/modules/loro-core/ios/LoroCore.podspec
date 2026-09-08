Pod::Spec.new do |s|
  s.name = 'LoroCore'
  s.version = '0.1.0'
  s.summary = 'Canonical Loro scheduling and merge operations through UniFFI.'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Loro'
  s.homepage = 'https://loro.app'
  s.source = { :git => 'https://github.com/asavienko/loro.git' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'

  # Per-file symlinks make CocoaPods discover the one committed generated binding.
  # CocoaPods ignores globs outside a pod root and does not traverse directory symlinks.
  bindings = 'generated'
  s.source_files = ['LoroCoreModule.swift', "#{bindings}/loro_core.swift"]
  s.preserve_paths = ["#{bindings}/loro_coreFFI.h", "#{bindings}/loro_coreFFI.modulemap"]
  s.libraries = 'loro_core', 'c++', 'resolv', 'iconv'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'ENABLE_USER_SCRIPT_SANDBOXING' => 'NO',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'OTHER_SWIFT_FLAGS' => "$(inherited) -Xcc -fmodule-map-file=\"$(PODS_TARGET_SRCROOT)/#{bindings}/loro_coreFFI.modulemap\"",
    'LIBRARY_SEARCH_PATHS' => '$(inherited) "$(BUILT_PRODUCTS_DIR)"'
  }
  s.user_target_xcconfig = {
    'LIBRARY_SEARCH_PATHS' => '$(inherited) "$(BUILT_PRODUCTS_DIR)"'
  }
  s.script_phase = {
    :name => 'Build canonical Loro Rust core',
    :script => 'bash "${PODS_TARGET_SRCROOT}/../scripts/build-ios.sh"',
    :shell_path => '/bin/bash',
    :execution_position => :before_compile,
    :always_out_of_date => '1',
    :output_files => ['$(BUILT_PRODUCTS_DIR)/libloro_core.a'],
    :show_env_vars_in_log => false
  }
end
