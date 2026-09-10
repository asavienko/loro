import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto'
import { normalizeListeningText } from '@loro/core'

export async function digestListeningText(text: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, normalizeListeningText(text))
}
