package expo.modules.lorocore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import uniffi.loro_core.coreCall

/** No scheduling arithmetic, sync policy, or recorded audio crosses into this adapter. */
class LoroCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LoroCore")

    Function("call") { method: String, inputJson: String ->
      coreCall(method, inputJson)
    }
  }
}
