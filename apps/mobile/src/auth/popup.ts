const POPUP_FEATURES = 'popup,width=500,height=700'
const POLL_MS = 250
const TIMEOUT_MS = 5 * 60_000

export interface PopupHandle {
  closed: boolean
  location: { href: string; assign?: (url: string) => void }
}

/** Reuse the click-opened window so browser popup policy still permits Google. */
export function navigatePopup(url: string, windowName: string, features = POPUP_FEATURES): Window {
  const popup = window.open(url, windowName, features)
  if (!popup) throw new Error('Popup blocked')
  try {
    popup.location.assign(url)
  } catch {
    // The named window may already be navigating.
  }
  return popup
}

export function watchPopupRedirect(
  popup: PopupHandle,
  redirect: string,
  poll: (tick: () => void) => ReturnType<typeof setInterval> = (tick) => setInterval(tick, POLL_MS),
  now: () => number = () => Date.now(),
  timeoutMs = TIMEOUT_MS,
): Promise<string | null> {
  const expected = new URL(redirect)
  return new Promise((resolve) => {
    const started = now()
    const timer: { id?: ReturnType<typeof setInterval> } = {}
    timer.id = poll(() => {
      if (popup.closed || now() - started > timeoutMs) {
        clearInterval(timer.id)
        resolve(null)
        return
      }
      try {
        const url = new URL(popup.location.href)
        if (
          url.origin !== expected.origin ||
          url.pathname !== expected.pathname ||
          (!url.searchParams.has('ticket') && !url.searchParams.has('error'))
        )
          return
        clearInterval(timer.id)
        resolve(url.toString())
      } catch {
        // Cross-origin while the provider page is showing.
      }
    })
  })
}
