import lessonData from './data/lessons.json'
import {
  buildPracticeQueue,
  createScoreSummary,
  isCorrectAnswer
} from './session.js'

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
                    <label class="lesson-card">
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

    languagePackSelect.addEventListener('change', () => {
      state.selectedLanguagePackId = languagePackSelect.value
      const nextPack = getActiveLanguagePack()
      const nextLessonIds = new Set(nextPack?.lessons.map((lesson) => lesson.id))
      state.selectedLessonIds = state.selectedLessonIds.filter((id) =>
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
