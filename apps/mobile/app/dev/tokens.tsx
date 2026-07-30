import { Unmatched } from 'expo-router'
import { Workbench } from '../../src/dev-tools/Workbench'
import { devToolsAreAvailable } from '../../src/dev-tools/gate'

export default function TokensWorkbenchRoute() {
  if (!devToolsAreAvailable()) return <Unmatched />

  return <Workbench />
}
