import { getNetworkStateAsync, addNetworkStateListener } from 'expo-network'
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync()
    return state.isConnected !== false && state.isInternetReachable !== false
  } catch {
    return false
  }
}
export function onNetworkAvailable(listener: () => void): () => void {
  const subscription = addNetworkStateListener((state) => {
    if (state.isConnected === true && state.isInternetReachable !== false) listener()
  })
  return () => {
    subscription.remove()
  }
}
