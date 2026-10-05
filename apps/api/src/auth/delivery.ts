import { writeFile } from 'node:fs/promises'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import {
  LOCAL_INBOX_DELIVERY,
  LOCAL_INBOX_PATH,
  RESEND_DELIVERY,
  SES_DELIVERY,
} from './settings.js'

export interface MagicCodePayload {
  email: string
  code: string
  expires_in: number
}

/** Where a code goes: `resend` or `ses` with a sender, `inbox:local`, or an HTTPS webhook with its bearer. */
export interface MagicDelivery {
  url: string
  token?: string | undefined
  from?: string | undefined
}

/** The one SES call delivery makes; tests pass their own. */
export type SendEmail = (command: SendEmailCommand, signal: AbortSignal) => Promise<unknown>

const DELIVERY_TIMEOUT_MILLISECONDS = 5_000
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

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
  if (delivery.url === RESEND_DELIVERY) {
    if (!delivery.from || !delivery.token) throw new Error('Delivery unavailable')
    await sendWithResend(delivery.token, delivery.from, payload)
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

/** Resend's email API with the key as the bearer. */
async function sendWithResend(
  apiKey: string,
  from: string,
  payload: MagicCodePayload,
): Promise<void> {
  const { subject, text } = magicCodeMessage(payload)
  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MILLISECONDS),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [payload.email], subject, text }),
  })
  // Resend's error text can quote the address, so only the status is kept (as the error's name).
  await response.body?.cancel()
  if (!response.ok) {
    const error = new Error('Delivery unavailable')
    error.name = `Resend${response.status}`
    throw error
  }
}

/** A plain-text email: the code first, how long it lasts, and what to do if it was not asked for. */
export function magicCodeMessage(payload: MagicCodePayload): { subject: string; text: string } {
  const minutes = Math.round(payload.expires_in / 60)
  return {
    subject: `${payload.code} is your Loro code`,
    text: [
      `Your Loro sign-in code is ${payload.code}.`,
      '',
      `Type it in the app within ${minutes} minutes.`,
      '',
      "If you didn't ask for a code, you can ignore this email.",
    ].join('\n'),
  }
}

export function magicCodeEmail(from: string, payload: MagicCodePayload): SendEmailCommand {
  const { subject, text } = magicCodeMessage(payload)
  return new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [payload.email] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
  })
}
