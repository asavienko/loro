import { message } from '../i18n'
export const languagesCopy = {
  get title() {
    return message('languages.title')
  },
  get native() {
    return message('languages.native')
  },
  get target() {
    return message('languages.target')
  },
  get save() {
    return message('languages.save')
  },
  get invalid() {
    return message('languages.invalid')
  },
  get review() {
    return message('languages.review')
  },
  personalMeaning: (language: string): string => message('languages.personalMeaning', { language }),
}
