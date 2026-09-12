import { message } from '../i18n'
export const accountCopy = {
  backend: {
    get checking() {
      return message('account.backend.checking')
    },
    get connected() {
      return message('account.backend.connected')
    },
    get unavailable() {
      return message('account.backend.unavailable')
    },
    get unconfigured() {
      return message('account.backend.unconfigured')
    },
    get scope() {
      return message('account.backend.scope')
    },
    get retry() {
      return message('account.backend.retry')
    },
  },
  get google() {
    return message('account.google')
  },
  get apple() {
    return message('account.apple')
  },
  get localData() {
    return message('account.localData')
  },
  get busy() {
    return message('account.busy')
  },
  get error() {
    return message('account.error')
  },
  get 'provider-error'() {
    return message('account.error')
  },
  get cancelled() {
    return message('account.cancelled')
  },
  get localSignOut() {
    return message('account.localSignOut')
  },
  get retry() {
    return message('account.retry')
  },
  get providersUnavailable() {
    return message('account.providersUnavailable')
  },
  get 'upgrade-sign-in'() {
    return message('account.upgrade-sign-in')
  },
  get 'upgrade-offline'() {
    return message('account.upgrade-offline')
  },
  get title() {
    return message('account.title')
  },
  get intro() {
    return message('account.intro')
  },
  get email() {
    return message('account.email')
  },
  get code() {
    return message('account.codeLabel')
  },
  get send() {
    return message('account.send')
  },
  get verify() {
    return message('account.verify')
  },
  get sent() {
    return message('account.sent')
  },
  get working() {
    return message('account.working')
  },
  get signedIn() {
    return message('account.signedIn')
  },
  get signOut() {
    return message('account.signOut')
  },
  get signOutNote() {
    return message('account.signOutNote')
  },
  get syncNow() {
    return message('account.syncNow')
  },
  get syncing() {
    return message('account.syncing')
  },
  get synced() {
    return message('account.synced')
  },
  get syncPending() {
    return message('account.syncPending')
  },
  get syncError() {
    return message('account.syncError')
  },
  syncQuarantined: (count: number): string => message('account.syncQuarantined', { count }),
  get unconfigured() {
    return message('account.unconfigured')
  },
  get network() {
    return message('account.network')
  },
  get 'rate-limited'() {
    return message('account.rate-limited')
  },
  get 'invalid-email'() {
    return message('account.invalid-email')
  },
  get 'invalid-code'() {
    return message('account.invalid-code')
  },
  get unavailable() {
    return message('account.unavailable')
  },
  get 'account-mismatch'() {
    return message('account.account-mismatch')
  },
  get storage() {
    return message('account.storage')
  },
  get webNote() {
    return message('account.webNote')
  },
  get differentEmail() {
    return message('account.differentEmail')
  },
  get deviceProgress() {
    return message('account.deviceProgress')
  },
  get heroTitle() {
    return message('account.heroTitle')
  },
  get heroBody() {
    return message('account.heroBody')
  },
  get emailMethod() {
    return message('account.emailMethod')
  },
  get emailTitle() {
    return message('account.emailTitle')
  },
  get emailBody() {
    return message('account.emailBody')
  },
  get codeTitle() {
    return message('account.codeTitle')
  },
  codeSentTo: (email: string): string => message('account.codeSentTo', { email }),
  get codePlaceholder() {
    return message('account.codePlaceholder')
  },
  get codeHint() {
    return message('account.codeHint')
  },
  get resend() {
    return message('account.resend')
  },
  get codeResent() {
    return message('account.codeResent')
  },
  get backToOptions() {
    return message('account.backToOptions')
  },
  get backToPractice() {
    return message('account.backToPractice')
  },
  get confirmationTitle() {
    return message('account.confirmationTitle')
  },
  get confirmationBody() {
    return message('account.confirmationBody')
  },
  get signInOptions() {
    return message('account.signInOptions')
  },
  get emailBack() {
    return message('account.emailBack')
  },
  get cancelSignIn() {
    return message('account.cancelSignIn')
  },
  get secureWindow() {
    return message('account.secureWindow')
  },
  get googleName() {
    return message('account.googleName')
  },
  get appleName() {
    return message('account.appleName')
  },
  connecting: (provider: 'google' | 'apple'): string =>
    message('account.connecting', {
      provider:
        provider === 'google' ? message('account.googleName') : message('account.appleName'),
    }),
  get discoveryError() {
    return message('account.discoveryError')
  },
  get methodUnavailable() {
    return message('account.methodUnavailable')
  },
}
