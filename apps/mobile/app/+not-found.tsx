import { Redirect, usePathname } from 'expo-router'
import { conditionalHome, resolveDeepLink } from '../src/lib/navigation'
import { useApp } from '../src/store'

/** Unknown and not-yet-built links return through the same first-run gate as home. */
export default function UnknownRoute() {
  const onboarded = useApp((state) => state.onboarded)
  const resolution = resolveDeepLink(usePathname(), onboarded)
  return (
    <Redirect
      href={resolution.kind === 'fallback' ? resolution.path : conditionalHome(onboarded)}
    />
  )
}
