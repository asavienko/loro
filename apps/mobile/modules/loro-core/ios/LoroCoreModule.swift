import ExpoModulesCore

/// Scheduling and merging are synchronous because a progress transaction must consume
/// the Rust result before committing. This bridge never receives recorded audio.
public final class LoroCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoroCore")

    Function("call") { (method: String, inputJson: String) throws -> String in
      try coreCall(method: method, input: inputJson)
    }
  }
}
