export const SHOW_TIMER_STORAGE_KEY = 'practicer:showTimer'
export const HIGH_SCORE_STORAGE_PREFIX = 'practicer:highScore'

export function buildLessonHighScoreStorageKey(languagePackId, direction, lessonId) {
  return [
    HIGH_SCORE_STORAGE_PREFIX,
    languagePackId || 'unknown-pack',
    direction || 'source-to-target',
    lessonId || 'unknown-lesson'
  ].join(':')
}

export function getScorePercentage(correctAnswers, totalQuestions) {
  if (totalQuestions <= 0) {
    return 0
  }

  return Math.round((correctAnswers / totalQuestions) * 100)
}

export function formatElapsedTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
