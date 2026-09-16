export function normalizeDirection(value) {
  return value === 'target-to-source' ? value : 'source-to-target'
}

function toLessonIdArray(value) {
  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(',')
    .map((lessonId) => lessonId.trim())
    .filter(Boolean)
}

function toPreviewPageIndex(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0
}

export function parseShortcutParams(search = '') {
  const params = new URLSearchParams(search)
  return {
    languagePackId: params.get('pack') ?? '',
    direction: normalizeDirection(params.get('direction')),
    selectedLessonIds: toLessonIdArray(params.get('lessons')),
    lessonId: params.get('lesson') ?? '',
    lessonPage: toPreviewPageIndex(params.get('page')),
    startPractice: params.get('practice') === '1'
  }
}

export function buildShortcutSearch({
  languagePackId = '',
  direction = 'source-to-target',
  selectedLessonIds = [],
  lessonId = '',
  lessonPage = 0,
  startPractice = false
} = {}) {
  const params = new URLSearchParams()

  if (languagePackId) {
    params.set('pack', languagePackId)
  }

  params.set('direction', normalizeDirection(direction))

  if (selectedLessonIds.length > 0) {
    params.set('lessons', selectedLessonIds.join(','))
  }

  if (lessonId) {
    params.set('lesson', lessonId)
  }

  if (lessonPage > 0) {
    params.set('page', String(lessonPage + 1))
  }

  if (startPractice) {
    params.set('practice', '1')
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
