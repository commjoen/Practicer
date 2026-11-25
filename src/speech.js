const SPEECH_CODES = {
  dutch: 'nl-NL',
  english: 'en-US',
  french: 'fr-FR',
  german: 'de-DE',
  italian: 'it-IT',
  portuguese: 'pt-PT',
  spanish: 'es-ES'
}

let activeUtterance = null

export function speechCodeForLanguage(languageName) {
  const key = String(languageName ?? '').trim().toLowerCase()
  return SPEECH_CODES[key] ?? ''
}

export function canUseSpeechSynthesis(target = globalThis) {
  return Boolean(
    target.speechSynthesis && typeof target.SpeechSynthesisUtterance === 'function'
  )
}

export function prepareSpeech(target = globalThis) {
  target.speechSynthesis?.getVoices?.()
}

function pickVoice(voices, lang) {
  if (!lang || !Array.isArray(voices) || voices.length === 0) {
    return null
  }

  const normalized = lang.toLowerCase()
  const prefix = normalized.slice(0, 2)
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(prefix)) ??
    null
  )
}

export function speakText(text, languageName, target = globalThis) {
  const synthesis = target.speechSynthesis
  const Utterance = target.SpeechSynthesisUtterance
  const spoken = String(text ?? '').trim()

  if (!synthesis || typeof Utterance !== 'function' || !spoken) {
    return false
  }

  synthesis.cancel()

  const utterance = new Utterance(spoken)
  const lang = speechCodeForLanguage(languageName)
  if (lang) {
    utterance.lang = lang
  }
  utterance.rate = 0.9

  const voice = pickVoice(synthesis.getVoices?.() ?? [], lang)
  if (voice) {
    utterance.voice = voice
  }

  activeUtterance = utterance
  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null
    }
  }
  synthesis.speak(utterance)
  return true
}

export function stopSpeaking(target = globalThis) {
  activeUtterance = null
  target.speechSynthesis?.cancel?.()
}
