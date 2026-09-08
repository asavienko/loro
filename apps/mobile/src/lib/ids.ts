/** F-02/F-04. Installation and learner row identities use platform CSPRNG entropy. */
import { createUserPhraseIds, type IdSource, type UserPhraseId } from '@loro/core'
import { deviceClock } from './clock'
import { randomBytes } from './entropy'
export const deviceIdSource: IdSource = { now: () => deviceClock.now(), bytes: randomBytes }
export const newId: () => UserPhraseId = createUserPhraseIds(deviceIdSource)
