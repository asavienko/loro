/** Plan 113: one message per device, in its language, with what a tap needs. */
import { describe, expect, it } from 'vitest'
import { PushTokenSchema } from '@loro/core/api/library'
import { messageFor } from './push.js'

describe('push messages', () => {
  const notice = { songId: 'song-1', albumId: 'album-1', title: 'Café', outcome: 'ready' as const }

  it('speak the device’s language and carry the song and album', () => {
    expect(messageFor('ExponentPushToken[abcdefgh]', 'bg', notice)).toEqual({
      to: 'ExponentPushToken[abcdefgh]',
      title: 'Песента ви е готова',
      body: '„Café“ е готова за слушане.',
      data: { kind: 'song', songId: 'song-1', albumId: 'album-1', outcome: 'ready' },
      sound: 'default',
    })
    expect(
      messageFor('ExponentPushToken[abcdefgh]', 'en', { ...notice, outcome: 'failed' }).body,
    ).toContain('couldn’t be made')
  })

  it('accept only Expo push tokens and the app’s UI languages', () => {
    expect(
      PushTokenSchema.safeParse({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', lang: 'cs' })
        .success,
    ).toBe(true)
    expect(
      PushTokenSchema.safeParse({
        token: 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        lang: 'pl',
        platform: 'ios',
      }).success,
    ).toBe(true)
    expect(PushTokenSchema.safeParse({ token: 'fcm:abcdef', lang: 'en' }).success).toBe(false)
    expect(
      PushTokenSchema.safeParse({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', lang: 'de' })
        .success,
    ).toBe(false)
  })
})
