import { writeFile } from 'node:fs/promises'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { LOCAL_INBOX_DELIVERY, LOCAL_INBOX_PATH, SES_DELIVERY } from './settings.js'

export interface MagicCodePayload {
  email: string
  code: string
  expires_in: number
}

/** Where a code goes: `ses`, `inbox:local`, or an HTTPS webhook with its bearer. */
export interface MagicDelivery {
  url: string
  token?: string | undefined
  from?: string | undefined
}

/** The one SES call delivery makes; tests pass their own. */
export type SendEmail = (command: SendEmailCommand, signal: AbortSignal) => Promise<unknown>

const DELIVERY_TIMEOUT_MILLISECONDS = 5_000

let sesClient: SESv2Client | undefined
const sendWithSes: SendEmail = (command, signal) => {
  // Region and credentials come from the host (AWS_REGION, the instance role).
  sesClient ??= new SESv2Client({})
  return sesClient.send(command, { abortSignal: signal })
}

export async function deliverMagicCode(
  delivery: MagicDelivery,
  payload: MagicCodePayload,
  inboxPath = LOCAL_INBOX_PATH,
  sendEmail: SendEmail = sendWithSes,
): Promise<void> {
  if (delivery.url === LOCAL_INBOX_DELIVERY) {
    await writeFile(inboxPath, JSON.stringify(payload), { mode: 0o600 })
    return
  }
  if (delivery.url === SES_DELIVERY) {
    if (!delivery.from) throw new Error('Delivery unavailable')
    await sendEmail(
      magicCodeEmail(delivery.from, payload),
      AbortSignal.timeout(DELIVERY_TIMEOUT_MILLISECONDS),
    )
    return
  }
  const response = await fetch(delivery.url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MILLISECONDS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${delivery.token ?? ''}`,
    },
    body: JSON.stringify(payload),
  })
  // Delivery response content is not a trusted error message and is never logged.
  await response.body?.cancel()
  if (!response.ok) throw new Error('Delivery unavailable')
}

/** A plain-text email: the code first, how long it lasts, and what to do if it was not asked for. */
export function magicCodeEmail(from: string, payload: MagicCodePayload): SendEmailCommand {
  const minutes = Math.round(payload.expires_in / 60)
  return new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [payload.email] },
    Content: {
      Simple: {
        Subject: { Data: `${payload.code} is your Loro code`, Charset: 'UTF-8' },
        Body: {
          Text: {
            Data: [
              `Your Loro sign-in code is ${payload.code}.`,
              '',
              `Type it in the app within ${minutes} minutes.`,
              '',
              "If you didn't ask for a code, you can ignore this email.",
            ].join('\n'),
            Charset: 'UTF-8',
          },
        },
      },
    },
  })
}
