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
    lessons: lessonData.lessons,
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

  function renderLessonPicker(message = '') {
    resetSession()

    root.innerHTML = `
      <main class="app-shell">
        <section class="hero-card">
          <p class="eyebrow">GitHub Pages language practice</p>
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
                We’ll show the ${escapeHtml(lessonData.sourceLanguage.toLowerCase())} meaning and ask for the
                ${escapeHtml(lessonData.targetLanguage)} spelling.
              </p>
            </div>
          </div>
          <form class="lesson-form" aria-label="Lesson selection">
            <div class="lesson-grid">
              ${state.lessons
                .map(
                  (lesson) => `
                    <label class="lesson-card">
                      <input type="checkbox" name="lesson" value="${escapeHtml(lesson.id)}" />
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

        <section class="panel plan-panel">
          <h2>Development plan</h2>
          <ol>
            <li>Start with static lesson content in JSON so teachers can extend lessons easily.</li>
            <li>Keep the first release focused on lesson selection, spelling practice, and scoring.</li>
            <li>Add automated lint, test, release, renovate, and Pages publishing workflows.</li>
            <li>Grow later with progress tracking, audio prompts, and richer lesson packs.</li>
          </ol>
        </section>
      </main>
    `

    const form = root.querySelector('.lesson-form')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const selectedLessonIds = getSelectedLessonIds(form)

      try {
        state.activeQueue = buildPracticeQueue(state.lessons, selectedLessonIds)
        state.currentIndex = 0
        state.correctAnswers = 0
        state.checkedAnswer = null
        renderQuestion()
      } catch (error) {
        renderLessonPicker(error.message)
      }
    })
  }

  function renderQuestion(feedback = '') {
    const question = state.activeQueue[state.currentIndex]
    const isLastQuestion = state.currentIndex === state.activeQueue.length - 1

    root.innerHTML = `
      <main class="app-shell">
        <section class="panel practice-panel">
          <div class="progress-row">
            <button class="ghost-button" type="button" data-action="restart">Change lessons</button>
            <p>Word ${state.currentIndex + 1} of ${state.activeQueue.length}</p>
          </div>
          <p class="lesson-tag">${escapeHtml(question.lessonName)}</p>
          <h1>${escapeHtml(question.prompt)}</h1>
          <p class="lead">Type the ${escapeHtml(lessonData.targetLanguage)} word that matches this meaning.</p>

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
              ? `<div class="feedback ${state.checkedAnswer?.correct ? 'correct' : 'incorrect'}" role="status">${escapeHtml(feedback)}</div>`
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
      const correct = isCorrectAnswer(answer, question.answer)

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
      state.currentIndex = 0
      state.correctAnswers = 0
      state.checkedAnswer = null
      state.submittedAnswer = ''
      renderQuestion()
    })

    root.querySelector('[data-action="lessons"]').addEventListener('click', () => {
      renderLessonPicker()
    })
  }

  renderLessonPicker()
}
