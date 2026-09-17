import lessonData from './data/lessons.json' with { type: 'json' }
import {
  buildPracticeQueue,
  createScoreSummary,
  isCorrectAnswer
} from './session.js'
import {
  buildShortcutSearch,
  normalizeDirection,
  parseShortcutParams,
  resolveShortcutAction
} from './url-state.js'
import {
  buildLessonHighScoreStorageKey,
  formatElapsedTime,
  getScorePercentage,
  SHOW_TIMER_STORAGE_KEY
} from './progress-utils.js'

const WORDS_PER_PAGE = 5
const LAST_LANGUAGE_PACK_STORAGE_KEY = 'practicer:lastLanguagePackId'

function getRememberedLanguagePackId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(LAST_LANGUAGE_PACK_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberLanguagePackId(languagePackId) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LAST_LANGUAGE_PACK_STORAGE_KEY, languagePackId)
  } catch {
    // Ignore unavailable storage.
  }
}

function getRememberedShowTimer() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(SHOW_TIMER_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberShowTimer(enabled) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SHOW_TIMER_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Ignore unavailable storage.
  }
}

function readLessonHighScore(languagePackId, direction, lessonId) {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const key = buildLessonHighScoreStorageKey(languagePackId, direction, lessonId)
    const rawValue = window.localStorage.getItem(key)
    const parsedValue = Number.parseInt(rawValue ?? '', 10)
    return Number.isFinite(parsedValue) ? Math.max(0, Math.min(parsedValue, 100)) : 0
  } catch {
    return 0
  }
}

function writeLessonHighScore(languagePackId, direction, lessonId, scorePercentage) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = buildLessonHighScoreStorageKey(languagePackId, direction, lessonId)
    const previousScore = readLessonHighScore(languagePackId, direction, lessonId)
    if (scorePercentage > previousScore) {
      window.localStorage.setItem(key, String(scorePercentage))
    }
  } catch {
    // Ignore unavailable storage.
  }
}

function createScoreImageBlob({
  lessonLabel,
  scoreLabel,
  timeLabel
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')

  if (!context) {
    return Promise.resolve(null)
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#f7fbff')
  gradient.addColorStop(1, '#eef5ff')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#7c57f2'
  context.fillRect(80, 80, canvas.width - 160, canvas.height - 160)
  context.fillStyle = '#ffffff'
  context.font = '700 42px Inter, sans-serif'
  context.fillText('Practicer score', 140, 180)
  context.font = '700 86px Inter, sans-serif'
  context.fillText(scoreLabel, 140, 300)
  context.font = '500 34px Inter, sans-serif'
  context.fillText(lessonLabel, 140, 380)
  context.fillText(timeLabel, 140, 440)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function createMessagesShareLink(encodedText) {
  if (typeof navigator === 'undefined') {
    return `sms:?body=${encodedText}`
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const isAppleDevice =
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ipod') ||
    userAgent.includes('macintosh')

  if (isAppleDevice) {
    return `sms:&body=${encodedText}`
  }

  return `sms:?body=${encodedText}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getSelectedLessonIds(form) {
  const formData = new FormData(form)
  return formData.getAll('lesson')
}

function toDisplayArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value === undefined || value === null) {
    return []
  }

  return [value]
}

function combineWordValues(primary, secondary) {
  const values = [...toDisplayArray(primary), ...toDisplayArray(secondary)]
    .map((value) => String(value).trim())
    .filter(Boolean)

  return [...new Set(values)]
}

export function createPracticeApp(root) {
  const rememberedLanguagePackId = getRememberedLanguagePackId()
  const hasRememberedLanguagePack = lessonData.languagePacks.some(
    (pack) => pack.id === rememberedLanguagePackId
  )
  const rememberedShowTimer = getRememberedShowTimer()

  const state = {
    languagePacks: lessonData.languagePacks,
    selectedLanguagePackId: hasRememberedLanguagePack
      ? rememberedLanguagePackId
      : (lessonData.languagePacks[0]?.id ?? ''),
    selectedDirection: 'source-to-target',
    selectedLessonIds: [],
    activeQueue: [],
    currentIndex: 0,
    correctAnswers: 0,
    checkedAnswer: null,
    submittedAnswer: '',
    showTimer: rememberedShowTimer,
    startedAt: 0,
    elapsedSeconds: 0,
    lessonStats: {}
  }
  let timerIntervalId = null
  let scoreImageUrl = ''

  function resetSession() {
    if (timerIntervalId) {
      window.clearInterval(timerIntervalId)
      timerIntervalId = null
    }
    if (scoreImageUrl) {
      URL.revokeObjectURL(scoreImageUrl)
      scoreImageUrl = ''
    }
    state.activeQueue = []
    state.currentIndex = 0
    state.correctAnswers = 0
    state.checkedAnswer = null
    state.submittedAnswer = ''
    state.startedAt = 0
    state.elapsedSeconds = 0
    state.lessonStats = {}
  }

  function startPracticeRound() {
    const activePack = getActiveLanguagePack()
    if (!activePack) {
      throw new Error('No language packs are available yet.')
    }

    rememberLanguagePackId(activePack.id)

    state.activeQueue = buildPracticeQueue(
      activePack.lessons,
      state.selectedLessonIds,
      state.selectedDirection
    )
    state.currentIndex = 0
    state.correctAnswers = 0
    state.checkedAnswer = null
    state.submittedAnswer = ''
    state.startedAt = Date.now()
    state.elapsedSeconds = 0
    state.lessonStats = state.activeQueue.reduce((stats, question) => {
      const existing = stats[question.lessonId] ?? { correct: 0, total: 0 }
      return {
        ...stats,
        [question.lessonId]: {
          correct: existing.correct,
          total: existing.total + 1
        }
      }
    }, {})
    syncUrlState({ startPractice: true })
    renderQuestion()
  }

  function getActiveLanguagePack() {
    return (
      state.languagePacks.find((pack) => pack.id === state.selectedLanguagePackId) ??
      state.languagePacks[0]
    )
  }

  function getDirectionLabels() {
    const activePack = getActiveLanguagePack()
    if (!activePack) {
      return {
        promptLanguage: 'source',
        answerLanguage: 'target'
      }
    }

    if (state.selectedDirection === 'target-to-source') {
      return {
        promptLanguage: activePack.targetLanguage,
        answerLanguage: activePack.sourceLanguage
      }
    }

    return {
      promptLanguage: activePack.sourceLanguage,
      answerLanguage: activePack.targetLanguage
    }
  }

  function filterLessonIdsForActivePack(selectedLessonIds) {
    const activePack = getActiveLanguagePack()
    const validLessonIds = new Set(activePack?.lessons.map((lesson) => lesson.id))
    return selectedLessonIds.filter((lessonId) => validLessonIds.has(lessonId))
  }

  function syncUrlState({
    lessonId = '',
    lessonPage = 0,
    startPractice = false
  } = {}) {
    if (typeof window === 'undefined') {
      return
    }

    const nextSearch = buildShortcutSearch({
      languagePackId: state.selectedLanguagePackId,
      direction: state.selectedDirection,
      selectedLessonIds: state.selectedLessonIds,
      lessonId,
      lessonPage,
      startPractice
    })
    const nextUrl = `${window.location.pathname}${nextSearch}`
    window.history.replaceState(null, '', nextUrl)
  }

  function updateElapsedSeconds() {
    if (!state.startedAt) {
      state.elapsedSeconds = 0
      return
    }

    state.elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000)
  }

  function renderTimerLabel() {
    const timerValue = root.querySelector('[data-timer-value]')
    if (!timerValue) {
      return
    }

    updateElapsedSeconds()
    timerValue.textContent = formatElapsedTime(state.elapsedSeconds)
  }

  function startTimer() {
    if (!state.showTimer || typeof window === 'undefined') {
      return
    }

    if (timerIntervalId) {
      window.clearInterval(timerIntervalId)
    }

    renderTimerLabel()
    timerIntervalId = window.setInterval(() => {
      renderTimerLabel()
    }, 1000)
  }

  function renderLessonWordPreview(lessonId, page = 0) {
    resetSession()
    const activePack = getActiveLanguagePack()
    if (!activePack) {
      renderLessonPicker('No lessons available yet.')
      return
    }

    const lesson = activePack.lessons.find((item) => item.id === lessonId)
    if (!lesson) {
      renderLessonPicker('Lesson not found.')
      return
    }

    const totalWords = lesson.words.length
    const totalPages = Math.max(1, Math.ceil(totalWords / WORDS_PER_PAGE))
    const currentPage = Math.min(Math.max(page, 0), totalPages - 1)
    const startIndex = currentPage * WORDS_PER_PAGE
    const pageWords = lesson.words.slice(startIndex, startIndex + WORDS_PER_PAGE)
    const hasWords = totalWords > 0
    const rangeStart = hasWords ? startIndex + 1 : 0
    const rangeEnd = hasWords
      ? Math.min(startIndex + WORDS_PER_PAGE, totalWords)
      : 0
    const hasNextPage = currentPage < totalPages - 1

    root.innerHTML = `
      <main class="app-shell">
        <section class="panel">
          <div class="progress-row">
            <button class="ghost-button" type="button" data-action="back-to-lessons">Back to lessons</button>
            <p>${escapeHtml(lesson.name)}</p>
          </div>
          <h1>Lesson words</h1>
          <p class="lead">${escapeHtml(lesson.description)}</p>
          <p class="preview-meta">Showing ${rangeStart}-${rangeEnd} of ${totalWords} words</p>

          <table class="word-preview-table">
            <caption class="sr-only">
              ${escapeHtml(lesson.name)} words in ${escapeHtml(activePack.sourceLanguage)} and ${escapeHtml(activePack.targetLanguage)}
            </caption>
            <thead>
              <tr>
                <th scope="col">${escapeHtml(activePack.sourceLanguage)}</th>
                <th scope="col">${escapeHtml(activePack.targetLanguage)}</th>
              </tr>
            </thead>
            <tbody>
              ${
                hasWords
                  ? pageWords
                    .map((word) => {
                      const source = combineWordValues(word.source, word.prompt).join(', ')
                      const target = combineWordValues(word.target, word.answer).join(', ')

                      return `
                        <tr>
                          <td>${escapeHtml(source)}</td>
                          <td>${escapeHtml(target)}</td>
                        </tr>
                      `
                    })
                    .join('')
                  : `
                    <tr>
                      <td colspan="2">No words in this lesson yet.</td>
                    </tr>
                  `
              }
            </tbody>
          </table>

          <div class="pagination-controls">
            <button type="button" class="ghost-button" data-action="previous-page" ${currentPage === 0 ? 'disabled' : ''}>
              Previous
            </button>
            <p>Page ${currentPage + 1} of ${totalPages}</p>
            <button
              type="button"
              class="ghost-button"
              data-action="next-page"
              ${hasNextPage ? '' : 'disabled aria-label="No next page"'}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    `

    syncUrlState({ lessonId: lesson.id, lessonPage: currentPage })

    root.querySelector('[data-action="back-to-lessons"]').addEventListener('click', () => {
      renderLessonPicker('', '', lesson.id)
    })

    root.querySelector('[data-action="previous-page"]')?.addEventListener('click', () => {
      renderLessonWordPreview(lesson.id, currentPage - 1)
    })

    root.querySelector('[data-action="next-page"]')?.addEventListener('click', () => {
      renderLessonWordPreview(lesson.id, currentPage + 1)
    })
  }

  function renderLessonPicker(message = '', focusSelector = '', focusLessonId = '') {
    resetSession()
    const activePack = getActiveLanguagePack()
    if (!activePack) {
      root.innerHTML = `
        <main class="app-shell">
          <section class="panel">
            <h2>No lessons available</h2>
            <p class="lead">Add at least one language pack to start practicing.</p>
          </section>
        </main>
      `

      syncUrlState()
      return
    }

    const directionLabels = getDirectionLabels()

    root.innerHTML = `
      <main class="app-shell">
        <section class="hero-card">
          <p class="eyebrow">Spelling practice for young language learners</p>
          <h1>Practicer</h1>
          <p class="lead">
            Help kids learn what a word means, then spell it on their own.
            Choose one or more lessons and start a playful spelling round.
          </p>
          <p>
            <a
              class="repo-link"
              href="https://github.com/commjoen/Practicer"
              target="_blank"
              rel="noreferrer"
            >
              View this repository on GitHub
            </a>
          </p>
        </section>

        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Pick today’s lessons</h2>
              <p>
                We’ll show the ${escapeHtml(directionLabels.promptLanguage.toLowerCase())} meaning and ask for the
                ${escapeHtml(directionLabels.answerLanguage)} spelling.
              </p>
            </div>
          </div>
          <form class="lesson-form" aria-label="Lesson selection">
            <div class="language-controls">
              <label class="input-label" for="languagePack">Language pair</label>
              <select id="languagePack" name="languagePack" class="answer-input">
                ${state.languagePacks
                  .map(
                    (pack) => `
                      <option value="${escapeHtml(pack.id)}" ${pack.id === activePack.id ? 'selected' : ''}>
                        ${escapeHtml(pack.name)}
                      </option>
                    `
                  )
                  .join('')}
              </select>
              <fieldset class="direction-options">
                <legend class="input-label">Practice direction</legend>
                <label>
                  <input
                    type="radio"
                    name="direction"
                    value="source-to-target"
                    ${state.selectedDirection === 'source-to-target' ? 'checked' : ''}
                  />
                  ${escapeHtml(activePack.sourceLanguage)} → ${escapeHtml(activePack.targetLanguage)}
                </label>
                <label>
                  <input
                    type="radio"
                    name="direction"
                    value="target-to-source"
                    ${state.selectedDirection === 'target-to-source' ? 'checked' : ''}
                  />
                  ${escapeHtml(activePack.targetLanguage)} → ${escapeHtml(activePack.sourceLanguage)}
                </label>
              </fieldset>
              <label class="timer-option">
                <input
                  type="checkbox"
                  name="showTimer"
                  value="1"
                  ${state.showTimer ? 'checked' : ''}
                />
                Show count-up timer during practice
              </label>
            </div>
            <div class="lesson-grid">
              ${activePack.lessons
                .map(
                  (lesson) => `
                    <article class="lesson-card">
                      <label class="lesson-select">
                        <input
                          type="checkbox"
                          name="lesson"
                          value="${escapeHtml(lesson.id)}"
                          ${state.selectedLessonIds.includes(lesson.id) ? 'checked' : ''}
                        />
                        <span>
                          <strong>${escapeHtml(lesson.name)}</strong>
                          <small>${escapeHtml(lesson.description)}</small>
                          <em>${lesson.words.length} words</em>
                          <small class="high-score">
                           High score: ${readLessonHighScore(
                             activePack.id,
                             state.selectedDirection,
                             lesson.id
                           )}%
                          </small>
                        </span>
                      </label>
                      <button
                        type="button"
                        class="ghost-button view-word-button"
                        data-action="view-lesson"
                        data-lesson-id="${escapeHtml(lesson.id)}"
                      >
                        View words
                      </button>
                    </article>
                  `
                )
                .join('')}
            </div>
            <div class="actions">
              <button type="submit" class="primary-button">Start practice</button>
              ${message ? `<p class="form-message" role="alert">${escapeHtml(message)}</p>` : ''}
            </div>
          </form>
        </section>
      </main>
    `

    syncUrlState()

    const form = root.querySelector('.lesson-form')
    const languagePackSelect = root.querySelector('#languagePack')
    const directionInputs = root.querySelectorAll('input[name="direction"]')
    const timerInput = root.querySelector('input[name="showTimer"]')
    const viewLessonButtons = root.querySelectorAll('[data-action="view-lesson"]')

    languagePackSelect.addEventListener('change', () => {
      const selectedLessonIds = getSelectedLessonIds(form)
      state.selectedLanguagePackId = languagePackSelect.value
      state.showTimer = Boolean(timerInput?.checked)
      const nextPack = getActiveLanguagePack()
      const nextLessonIds = new Set(nextPack?.lessons.map((lesson) => lesson.id))
      state.selectedLessonIds = selectedLessonIds.filter((id) =>
        nextLessonIds.has(id)
      )
      syncUrlState()
      renderLessonPicker(message, '#languagePack')
    })

    directionInputs.forEach((input) => {
      input.addEventListener('change', () => {
        state.selectedLessonIds = getSelectedLessonIds(form)
        state.selectedDirection = input.value
        state.showTimer = Boolean(timerInput?.checked)
        syncUrlState()
        renderLessonPicker(
          message,
          `input[name="direction"][value="${state.selectedDirection}"]`
        )
      })
    })

    viewLessonButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedLessonIds = getSelectedLessonIds(form)
        const lessonId = button.dataset.lessonId
        renderLessonWordPreview(lessonId)
      })
    })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const formData = new FormData(form)
      const selectedLanguagePackId = formData.get('languagePack')
      const selectedDirection = formData.get('direction')
      state.selectedLanguagePackId =
        typeof selectedLanguagePackId === 'string'
          ? selectedLanguagePackId
          : state.selectedLanguagePackId
      state.selectedDirection =
        selectedDirection === 'target-to-source'
          ? selectedDirection
          : 'source-to-target'
      state.showTimer = formData.get('showTimer') === '1'
      rememberShowTimer(state.showTimer)
      const selectedLessonIds = getSelectedLessonIds(form)
      state.selectedLessonIds = selectedLessonIds

      try {
        startPracticeRound()
      } catch (error) {
        renderLessonPicker(error.message)
      }
    })

    form.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === 'lesson') {
        state.selectedLessonIds = getSelectedLessonIds(form)
        syncUrlState()
      }

      if (event.target instanceof HTMLInputElement && event.target.name === 'showTimer') {
        state.showTimer = event.target.checked
        rememberShowTimer(state.showTimer)
      }
    })

    if (focusLessonId) {
      const focusTarget = [...viewLessonButtons].find(
        (button) => button.dataset.lessonId === focusLessonId
      )
      focusTarget?.focus()
      return
    }

    if (focusSelector) {
      root.querySelector(focusSelector)?.focus()
    }
  }

  function renderQuestion(feedback = '') {
    const question = state.activeQueue[state.currentIndex]
    const isLastQuestion = state.currentIndex === state.activeQueue.length - 1
    const directionLabels = getDirectionLabels()

    root.innerHTML = `
      <main class="app-shell">
        <section class="panel practice-panel">
          <div class="progress-row">
            <button class="ghost-button" type="button" data-action="restart">Change lessons</button>
            <div class="practice-meta">
              <p>Word ${state.currentIndex + 1} of ${state.activeQueue.length}</p>
              ${
                state.showTimer
                  ? '<p class="timer-readout">Timer: <strong data-timer-value>00:00</strong></p>'
                  : ''
              }
            </div>
          </div>
          <p class="lesson-tag">${escapeHtml(question.lessonName)}</p>
          <h1>${escapeHtml(question.prompt)}</h1>
          <p class="lead">Type the ${escapeHtml(directionLabels.answerLanguage)} word that matches this meaning.</p>

          <form class="answer-form">
            <label for="answer" class="input-label">Your spelling</label>
            <input
              id="answer"
              name="answer"
              class="answer-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              ${state.checkedAnswer ? 'disabled' : ''}
              required
            />
            <div class="actions">
              <button type="submit" class="primary-button" ${state.checkedAnswer ? 'disabled' : ''}>Check answer</button>
            </div>
          </form>

          ${
            feedback
              ? `<div class="feedback ${state.checkedAnswer?.correct ? 'correct' : 'incorrect'}" role="${state.checkedAnswer?.correct ? 'status' : 'alert'}">${escapeHtml(feedback)}</div>`
              : ''
          }

          ${
            state.checkedAnswer
              ? `<div class="actions">
                  <button type="button" class="primary-button" data-action="next">
                    ${isLastQuestion ? 'See score' : 'Next word'}
                  </button>
                </div>`
              : ''
          }
        </section>
      </main>
    `

    const restartButton = root.querySelector('[data-action="restart"]')
    restartButton.addEventListener('click', () => renderLessonPicker())
    startTimer()

    const form = root.querySelector('.answer-form')
    const answerInput = root.querySelector('#answer')
    answerInput.value = state.submittedAnswer

    if (!state.checkedAnswer) {
      answerInput.focus()
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()

      if (state.checkedAnswer) {
        return
      }

      const answer = answerInput.value
      state.submittedAnswer = answer
      const correct = isCorrectAnswer(answer, question.acceptedAnswers)

      if (correct) {
        state.correctAnswers += 1
        const lessonStats = state.lessonStats[question.lessonId]
        if (lessonStats) {
          lessonStats.correct += 1
        }
      }

      state.checkedAnswer = { correct }
      answerInput.disabled = true

      renderQuestion(
        correct
          ? `Correct! “${question.answer}” is the right spelling.`
          : `Not quite. The correct spelling is “${question.answer}”.`
      )
    })

    const nextButton = root.querySelector('[data-action="next"]')

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        state.checkedAnswer = null
        state.submittedAnswer = ''

        if (isLastQuestion) {
          renderScore()
          return
        }

        state.currentIndex += 1
        renderQuestion()
      })
    }
  }

  function renderScore() {
    if (timerIntervalId && typeof window !== 'undefined') {
      window.clearInterval(timerIntervalId)
      timerIntervalId = null
    }
    updateElapsedSeconds()
    const percentage = getScorePercentage(state.correctAnswers, state.activeQueue.length)
    const activePack = getActiveLanguagePack()
    const selectedLessons = activePack
      ? activePack.lessons.filter((lesson) => state.selectedLessonIds.includes(lesson.id))
      : []

    if (activePack) {
      selectedLessons.forEach((lesson) => {
        const lessonStats = state.lessonStats[lesson.id]
        const lessonPercentage = getScorePercentage(
          lessonStats?.correct ?? 0,
          lessonStats?.total ?? 0
        )
        writeLessonHighScore(
          activePack.id,
          state.selectedDirection,
          lesson.id,
          lessonPercentage
        )
      })
    }

    root.innerHTML = `
      <main class="app-shell">
        <section class="panel score-panel">
          <p class="eyebrow">Practice complete</p>
          <h1>${state.correctAnswers} / ${state.activeQueue.length}</h1>
          <p class="lead">${createScoreSummary(state.correctAnswers, state.activeQueue.length)}</p>
          ${
            state.showTimer
              ? `<p class="lead">Time: ${formatElapsedTime(state.elapsedSeconds)}</p>`
              : ''
          }
          ${
            selectedLessons.length > 0
              ? `
                <p class="lead">
                  ${selectedLessons
                    .map(
                      (lesson) =>
                        `${escapeHtml(lesson.name)} best: ${readLessonHighScore(
                          activePack.id,
                          state.selectedDirection,
                          lesson.id
                        )}%`
                    )
                    .join(' · ')}
                </p>
              `
              : ''
          }
          <div class="actions stacked">
            <button type="button" class="primary-button" data-action="share-score">Share score</button>
            <button type="button" class="primary-button" data-action="again">Practice again</button>
            <button type="button" class="ghost-button" data-action="lessons">Pick different lessons</button>
          </div>
          <p class="form-message" role="status" data-share-status></p>
          <div class="share-links" data-share-links hidden>
            <button type="button" class="ghost-button" data-share-target="x">Share on X</button>
            <button type="button" class="ghost-button" data-share-target="facebook">Share on Facebook</button>
            <button type="button" class="ghost-button" data-share-target="messages">Share via SMS/Messages</button>
            <button type="button" class="ghost-button" data-share-target="email">Share via email</button>
            <button type="button" class="ghost-button" data-share-target="download">Download score image</button>
          </div>
        </section>
      </main>
    `

    const shareScoreButton = root.querySelector('[data-action="share-score"]')
    const shareLinks = root.querySelector('[data-share-links]')
    const shareStatus = root.querySelector('[data-share-status]')
    const shareTargetButtons = {
      x: shareLinks?.querySelector('[data-share-target="x"]'),
      facebook: shareLinks?.querySelector('[data-share-target="facebook"]'),
      messages: shareLinks?.querySelector('[data-share-target="messages"]'),
      email: shareLinks?.querySelector('[data-share-target="email"]'),
      download: shareLinks?.querySelector('[data-share-target="download"]')
    }
    const fallbackShareUrls = {
      x: '',
      facebook: '',
      messages: '',
      email: ''
    }

    shareTargetButtons.x?.addEventListener('click', () => {
      if (fallbackShareUrls.x) {
        window.open(fallbackShareUrls.x, '_blank', 'noopener,noreferrer')
      }
    })
    shareTargetButtons.facebook?.addEventListener('click', () => {
      if (fallbackShareUrls.facebook) {
        window.open(fallbackShareUrls.facebook, '_blank', 'noopener,noreferrer')
      }
    })
    shareTargetButtons.messages?.addEventListener('click', () => {
      if (fallbackShareUrls.messages) {
        window.location.href = fallbackShareUrls.messages
      }
    })
    shareTargetButtons.email?.addEventListener('click', () => {
      if (fallbackShareUrls.email) {
        window.location.href = fallbackShareUrls.email
      }
    })
    shareTargetButtons.download?.addEventListener('click', () => {
      if (!scoreImageUrl) {
        return
      }

      const downloadLink = document.createElement('a')
      downloadLink.href = scoreImageUrl
      downloadLink.download = 'practicer-score.png'
      downloadLink.click()
    })

    shareScoreButton.addEventListener('click', async () => {
      try {
        shareScoreButton.disabled = true
        if (shareStatus) {
          shareStatus.textContent = 'Preparing your score image...'
        }
        const lessonLabel =
          selectedLessons.length === 1
            ? `Lesson: ${selectedLessons[0].name}`
            : `Lessons: ${selectedLessons.length}`
        const scoreLabel = `${state.correctAnswers} / ${state.activeQueue.length} (${percentage}%)`
        const timeLabel = state.showTimer
          ? `Time: ${formatElapsedTime(state.elapsedSeconds)}`
          : 'Time: hidden'
        const shareText = `I scored ${scoreLabel} in Practicer. ${lessonLabel}`
        const imageBlob = await createScoreImageBlob({
          lessonLabel,
          scoreLabel,
          timeLabel
        })

        if (scoreImageUrl) {
          URL.revokeObjectURL(scoreImageUrl)
          scoreImageUrl = ''
        }

        if (imageBlob) {
          scoreImageUrl = URL.createObjectURL(imageBlob)
        }

        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            const file =
              imageBlob &&
              typeof File !== 'undefined'
                ? new File([imageBlob], 'practicer-score.png', { type: 'image/png' })
                : null
            const payload = file
              ? { title: 'Practicer score', text: shareText, files: [file] }
              : null

            if (payload && (!navigator.canShare || navigator.canShare(payload))) {
              await navigator.share(payload)
              if (shareStatus) {
                shareStatus.textContent = 'Score shared.'
              }
              return
            }

            await navigator.share({ title: 'Practicer score', text: shareText })
            if (shareStatus) {
              shareStatus.textContent = 'Score shared.'
            }
            return
          } catch (error) {
            if (
              error &&
              typeof error === 'object' &&
              ('name' in error || 'message' in error) &&
              (error.name === 'AbortError' ||
                (typeof error.message === 'string' &&
                  error.message.toLowerCase().includes('cancel')))
            ) {
              if (shareStatus) {
                shareStatus.textContent = 'Share cancelled.'
              }
              return
            }
            // Fall back to direct links.
          }
        }

        if (!shareLinks) {
          return
        }

        const encodedText = encodeURIComponent(`${shareText} https://commjoen.github.io/Practicer/`)
        const encodedUrl = encodeURIComponent('https://commjoen.github.io/Practicer/')
        fallbackShareUrls.x = `https://x.com/intent/post?text=${encodedText}`
        fallbackShareUrls.facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        fallbackShareUrls.messages = createMessagesShareLink(encodedText)
        fallbackShareUrls.email = `mailto:?subject=Practicer%20score&body=${encodedText}`

        shareLinks.hidden = false
        if (shareStatus) {
          shareStatus.textContent = 'Choose where to share your score.'
        }
      } finally {
        shareScoreButton.disabled = false
      }
    })

    root.querySelector('[data-action="again"]').addEventListener('click', () => {
      startPracticeRound()
    })

    root.querySelector('[data-action="lessons"]').addEventListener('click', () => {
      renderLessonPicker()
    })
  }

  const shortcuts = parseShortcutParams(
    typeof window === 'undefined' ? '' : window.location.search
  )
  const hasRequestedPack = Boolean(shortcuts.languagePackId)
  const hasValidShortcutPack =
    !hasRequestedPack ||
    state.languagePacks.some((pack) => pack.id === shortcuts.languagePackId)
  if (hasRequestedPack && hasValidShortcutPack) {
    state.selectedLanguagePackId = shortcuts.languagePackId
  }
  state.selectedDirection = normalizeDirection(shortcuts.direction)
  state.selectedLessonIds = filterLessonIdsForActivePack(shortcuts.selectedLessonIds)
  const shortcutLessonExists = getActiveLanguagePack()?.lessons.some(
    (lesson) => lesson.id === shortcuts.lessonId
  )
  const shortcutAction = resolveShortcutAction({
    requestedPackId: shortcuts.languagePackId,
    hasValidRequestedPack: hasValidShortcutPack,
    lessonId: shortcuts.lessonId,
    lessonExistsInPack: shortcutLessonExists,
    startPractice: shortcuts.startPractice,
    selectedLessonIds: state.selectedLessonIds
  })

  if (shortcutAction.type === 'preview') {
    renderLessonWordPreview(shortcuts.lessonId, shortcuts.lessonPage)
    return
  }

  if (shortcutAction.type === 'practice') {
    startPracticeRound()
    return
  }

  renderLessonPicker(shortcutAction.message ?? '')
}
