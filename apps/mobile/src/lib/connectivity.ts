/** Web has an explicit offline signal; an online signal is only permission to attempt transport. */
export function isNetworkAvailable(): Promise<boolean> {
  return Promise.resolve(typeof navigator === 'undefined' || navigator.onLine)
}
export function onNetworkAvailable(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('online', listener)
  return () => {
    window.removeEventListener('online', listener)
  }
}
