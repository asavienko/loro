import { Redirect, usePathname } from 'expo-router'
import { conditionalHome, resolveDeepLink } from '../src/lib/navigation'
import { useAccount } from '../src/lib/account/runtime'
import { useApp } from '../src/store'

/** Unknown and not-yet-built links return through the same sign-in and first-run gate as home. */
export default function UnknownRoute() {
  const signedIn = useAccount().session !== null
  const onboarded = useApp((state) => state.onboarded)
  const access = { signedIn, onboarded }
  const resolution = resolveDeepLink(usePathname(), access)
  return (
    <Redirect href={resolution.kind === 'fallback' ? resolution.path : conditionalHome(access)} />
  )
}
