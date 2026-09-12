import { writeFile } from 'node:fs/promises'
import { LOCAL_INBOX_DELIVERY, LOCAL_INBOX_PATH } from './settings.js'

export async function deliverMagicCode(
  url: string,
  token: string,
  payload: { email: string; code: string; expires_in: number },
  inboxPath = LOCAL_INBOX_PATH,
): Promise<void> {
  if (url === LOCAL_INBOX_DELIVERY) {
    await writeFile(inboxPath, JSON.stringify(payload), { mode: 0o600 })
    return
  }
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  // Delivery response content is not a trusted error message and is never logged.
  await response.body?.cancel()
  if (!response.ok) throw new Error('Delivery unavailable')
}
