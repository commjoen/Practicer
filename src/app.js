import lessonData from './data/lessons.json'
import {
  buildPracticeQueue,
  createScoreSummary,
  isCorrectAnswer
} from './session.js'

const WORDS_PER_PAGE = 5

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

function toDisplayArray(value, fallback = '') {
  if (Array.isArray(value)) {
    return value
  }

  return [value ?? fallback]
}

export function createPracticeApp(root) {
  const state = {
    languagePacks: lessonData.languagePacks,
    selectedLanguagePackId: lessonData.languagePacks[0]?.id ?? '',
    selectedDirection: 'source-to-target',
    selectedLessonIds: [],
    activeQueue: [],
    currentIndex: 0,
    correctAnswers: 0,
    checkedAnswer: null,
    submittedAnswer: ''
  }

  function resetSession() {
    state.activeQueue = []
    state.currentIndex = 0
    state.correctAnswers = 0
    state.checkedAnswer = null
    state.submittedAnswer = ''
  }

  function startPracticeRound() {
    const activePack = getActiveLanguagePack()
    if (!activePack) {
      throw new Error('No language packs are available yet.')
    }

    state.activeQueue = buildPracticeQueue(
      activePack.lessons,
      state.selectedLessonIds,
      state.selectedDirection
    )
    state.currentIndex = 0
    state.correctAnswers = 0
    state.checkedAnswer = null
    state.submittedAnswer = ''
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

    root.innerHTML = `
      <main class="app-shell">
        <section class="panel">
          <div class="progress-row">
            <button class="ghost-button" type="button" data-action="back-to-lessons">Back to lessons</button>
            <p>${escapeHtml(lesson.name)}</p>
          </div>
          <h1>Lesson words</h1>
          <p class="lead">${escapeHtml(lesson.description)}</p>
          <p class="preview-meta">Showing ${startIndex + 1}-${Math.min(startIndex + WORDS_PER_PAGE, totalWords)} of ${totalWords} words</p>

          <table class="word-preview-table">
            <thead>
              <tr>
                <th>${escapeHtml(activePack.sourceLanguage)}</th>
                <th>${escapeHtml(activePack.targetLanguage)}</th>
              </tr>
            </thead>
            <tbody>
              ${pageWords
                .map((word) => {
                  const source = toDisplayArray(word.source, word.prompt).join(', ')
                  const target = toDisplayArray(word.target, word.answer).join(', ')

                  return `
                    <tr>
                      <td>${escapeHtml(source)}</td>
                      <td>${escapeHtml(target)}</td>
                    </tr>
                  `
                })
                .join('')}
            </tbody>
          </table>

          <div class="pagination-controls">
            <button type="button" class="ghost-button" data-action="previous-page" ${currentPage === 0 ? 'disabled' : ''}>
              Previous
            </button>
            <p>Page ${currentPage + 1} of ${totalPages}</p>
            <button type="button" class="ghost-button" data-action="next-page" ${currentPage === totalPages - 1 ? 'disabled' : ''}>
              Next
            </button>
          </div>
        </section>
      </main>
    `

    root.querySelector('[data-action="back-to-lessons"]').addEventListener('click', () => {
      renderLessonPicker('', `[data-action="view-lesson"][data-lesson-id="${lesson.id}"]`)
    })

    root.querySelector('[data-action="previous-page"]')?.addEventListener('click', () => {
      renderLessonWordPreview(lesson.id, currentPage - 1)
    })

    root.querySelector('[data-action="next-page"]')?.addEventListener('click', () => {
      renderLessonWordPreview(lesson.id, currentPage + 1)
    })
  }

  function renderLessonPicker(message = '', focusSelector = '') {
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

    const form = root.querySelector('.lesson-form')
    const languagePackSelect = root.querySelector('#languagePack')
    const directionInputs = root.querySelectorAll('input[name="direction"]')
    const viewLessonButtons = root.querySelectorAll('[data-action="view-lesson"]')

    languagePackSelect.addEventListener('change', () => {
      const selectedLessonIds = getSelectedLessonIds(form)
      state.selectedLanguagePackId = languagePackSelect.value
      const nextPack = getActiveLanguagePack()
      const nextLessonIds = new Set(nextPack?.lessons.map((lesson) => lesson.id))
      state.selectedLessonIds = selectedLessonIds.filter((id) =>
        nextLessonIds.has(id)
      )
      renderLessonPicker(message, '#languagePack')
    })

    directionInputs.forEach((input) => {
      input.addEventListener('change', () => {
        state.selectedLessonIds = getSelectedLessonIds(form)
        state.selectedDirection = input.value
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
      const selectedLessonIds = getSelectedLessonIds(form)
      state.selectedLessonIds = selectedLessonIds

      try {
        startPracticeRound()
      } catch (error) {
        renderLessonPicker(error.message)
      }
    })

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
            <p>Word ${state.currentIndex + 1} of ${state.activeQueue.length}</p>
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
    root.innerHTML = `
      <main class="app-shell">
        <section class="panel score-panel">
          <p class="eyebrow">Practice complete</p>
          <h1>${state.correctAnswers} / ${state.activeQueue.length}</h1>
          <p class="lead">${createScoreSummary(state.correctAnswers, state.activeQueue.length)}</p>
          <div class="actions stacked">
            <button type="button" class="primary-button" data-action="again">Practice again</button>
            <button type="button" class="ghost-button" data-action="lessons">Pick different lessons</button>
          </div>
        </section>
      </main>
    `

    root.querySelector('[data-action="again"]').addEventListener('click', () => {
      startPracticeRound()
    })

    root.querySelector('[data-action="lessons"]').addEventListener('click', () => {
      renderLessonPicker()
    })
  }

  renderLessonPicker()
}
