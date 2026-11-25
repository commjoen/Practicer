import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canUseSpeechSynthesis,
  speakText,
  speechCodeForLanguage,
  stopSpeaking
} from './speech.js'

test('speechCodeForLanguage maps lesson language names', () => {
  assert.equal(speechCodeForLanguage('Spanish'), 'es-ES')
  assert.equal(speechCodeForLanguage('English'), 'en-US')
  assert.equal(speechCodeForLanguage('Dutch'), 'nl-NL')
  assert.equal(speechCodeForLanguage('  french '), 'fr-FR')
  assert.equal(speechCodeForLanguage('Klingon'), '')
})

test('canUseSpeechSynthesis detects the speech API', () => {
  assert.equal(canUseSpeechSynthesis({}), false)
  assert.equal(
    canUseSpeechSynthesis({
      speechSynthesis: {},
      SpeechSynthesisUtterance: function Utterance() {}
    }),
    true
  )
})

test('speakText reads the requested word in that language', () => {
  const spoken = []

  class Utterance {
    constructor(text) {
      this.text = text
      this.lang = ''
      this.rate = 1
      this.voice = null
    }
  }

  const synthesis = {
    cancel() {
      spoken.push('cancel')
    },
    getVoices() {
      return [
        { lang: 'en-US', name: 'English' },
        { lang: 'es-ES', name: 'Spanish' }
      ]
    },
    speak(utterance) {
      spoken.push(utterance)
    }
  }

  const target = {
    speechSynthesis: synthesis,
    SpeechSynthesisUtterance: Utterance
  }

  assert.equal(speakText('gato', 'Spanish', target), true)
  assert.equal(spoken[0], 'cancel')
  assert.equal(spoken[1].text, 'gato')
  assert.equal(spoken[1].lang, 'es-ES')
  assert.equal(spoken[1].voice.name, 'Spanish')
  assert.equal(spoken[1].rate, 0.9)
})

test('speakText ignores blank text and missing speech support', () => {
  assert.equal(speakText('cat', 'English', {}), false)
  assert.equal(
    speakText('   ', 'English', {
      speechSynthesis: { cancel() {}, speak() {} },
      SpeechSynthesisUtterance: class Utterance {}
    }),
    false
  )
})

test('stopSpeaking cancels playback', () => {
  let cancelled = false
  stopSpeaking({
    speechSynthesis: {
      cancel() {
        cancelled = true
      }
    }
  })
  assert.equal(cancelled, true)
  stopSpeaking({})
})
