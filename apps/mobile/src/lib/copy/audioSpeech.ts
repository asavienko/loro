import { message } from '../i18n'
export const audioSpeechCopy = {
  get hear() {
    return message('audioSpeech.hear')
  },
  get stop() {
    return message('audioSpeech.stop')
  },
  get play() {
    return message('audioSpeech.play')
  },
  get tts() {
    return message('audioSpeech.tts')
  },
  get unavailable() {
    return message('audioSpeech.unavailable')
  },
  get error() {
    return message('audioSpeech.error')
  },
  get loading() {
    return message('audioSpeech.loading')
  },
  get playing() {
    return message('audioSpeech.playing')
  },
  get speakTitle() {
    return message('audioSpeech.speakTitle')
  },
  get speakIntro() {
    return message('audioSpeech.speakIntro')
  },
  get privacy() {
    return message('audioSpeech.privacy')
  },
  get revealMode() {
    return message('audioSpeech.revealMode')
  },
  get reveal() {
    return message('audioSpeech.reveal')
  },
  get listen() {
    return message('audioSpeech.listen')
  },
  get listening() {
    return message('audioSpeech.listening')
  },
  get stopListening() {
    return message('audioSpeech.stopListening')
  },
  get heardNothing() {
    return message('audioSpeech.heardNothing')
  },
  get retry() {
    return message('audioSpeech.retry')
  },
  get revealedDone() {
    return message('audioSpeech.revealedDone')
  },
  get spokenDone() {
    return message('audioSpeech.spokenDone')
  },
  get next() {
    return message('audioSpeech.next')
  },
  get skip() {
    return message('audioSpeech.skip')
  },
  get practiceSpeak() {
    return message('audioSpeech.practiceSpeak')
  },
  wordProgress: (revealed: number, total: number): string =>
    message('audioSpeech.wordProgress', { revealed, total }),
  get hiddenWord() {
    return message('audioSpeech.hiddenWord')
  },
  get saveError() {
    return message('audioSpeech.saveError')
  },
}
