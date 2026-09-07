import ExpoModulesCore

public class LoroCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoroCore")
    Function("coreCall") { (request: String) -> String in
      coreCall(request: request)
    }
  }
}
