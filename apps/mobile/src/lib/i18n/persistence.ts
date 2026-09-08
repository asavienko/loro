/** Local boot/recovery copy, bundled with the app and available without a network. */
import { currentNativeLanguage } from './index'
const resources = {
  en: {
    error: 'Your progress could not be saved.',
    loading: 'Opening your progress…',
    title: 'Your progress could not be opened',
    body: 'Your saved data has been kept. Free some device storage or update Loro, then try again.',
    retry: 'Try again',
  },
  bg: {
    error: 'Напредъкът не може да се запази.',
    loading: 'Зареждане на напредъка…',
    title: 'Напредъкът не може да се отвори',
    body: 'Запазените данни са съхранени. Освободете място или обновете Loro и опитайте отново.',
    retry: 'Опитайте отново',
  },
  ru: {
    error: 'Не удалось сохранить ваш прогресс.',
    loading: 'Загрузка прогресса…',
    title: 'Не удалось открыть ваш прогресс',
    body: 'Сохранённые данные остались на устройстве. Освободите место или обновите Loro и попробуйте снова.',
    retry: 'Попробовать снова',
  },
}
export const persistenceCopy = {
  get error() {
    return resources[currentNativeLanguage()].error
  },
  get loading() {
    return resources[currentNativeLanguage()].loading
  },
  get title() {
    return resources[currentNativeLanguage()].title
  },
  get body() {
    return resources[currentNativeLanguage()].body
  },
  get retry() {
    return resources[currentNativeLanguage()].retry
  },
}
