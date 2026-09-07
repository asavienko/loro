package expo.modules.lorocore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import uniffi.loro_core.coreCall

class LoroCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LoroCore")
    Function("coreCall") { request: String -> coreCall(request) }
  }
}
