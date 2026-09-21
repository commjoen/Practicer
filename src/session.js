export function normalizeAnswer(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function toVariantArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  return [value]
}

export function isCorrectAnswer(answer, expectedAnswer) {
  const normalizedAnswer = normalizeAnswer(answer)
  return toVariantArray(expectedAnswer).some(
    (candidate) => normalizeAnswer(candidate) === normalizedAnswer
  )
}

function createWordEntry(word, direction) {
  const source = toVariantArray(word.source ?? word.prompt)
  const target = toVariantArray(word.target ?? word.answer)

  if (direction === 'target-to-source') {
    return {
      prompt: target.join(', '),
      answer: source[0],
      acceptedAnswers: source
    }
  }

  return {
    prompt: source.join(', '),
    answer: target[0],
    acceptedAnswers: target
  }
}

function shuffleQueue(queue, randomSource) {
  const shuffledQueue = [...queue]

  for (let index = shuffledQueue.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(randomSource() * (index + 1))
    ;[shuffledQueue[index], shuffledQueue[randomIndex]] = [
      shuffledQueue[randomIndex],
      shuffledQueue[index]
    ]
  }

  return shuffledQueue
}

export function buildPracticeQueue(
  lessons,
  selectedLessonIds,
  direction = 'source-to-target',
  {
    randomizeWords = false,
    randomSource = Math.random
  } = {}
) {
  const selected = lessons.filter(({ id }) => selectedLessonIds.includes(id))

  if (selected.length === 0) {
    throw new Error('Select at least one lesson to start practicing.')
  }

  const queue = selected.flatMap((lesson) =>
    lesson.words.map((word) => ({
      lessonId: lesson.id,
      lessonName: lesson.name,
      ...createWordEntry(word, direction)
    }))
  )

  if (!randomizeWords) {
    return queue
  }

  return shuffleQueue(queue, randomSource)
}

export function createScoreSummary(correctAnswers, totalQuestions) {
  if (totalQuestions === 0) {
    return 'Pick a lesson to start your first practice round.'
  }

  const percentage = Math.round((correctAnswers / totalQuestions) * 100)

  if (percentage === 100) {
    return `Perfect score! ${correctAnswers}/${totalQuestions} words correct.`
  }

  if (percentage >= 60) {
    return `Great job! ${correctAnswers}/${totalQuestions} words correct.`
  }

  return `Nice try! ${correctAnswers}/${totalQuestions} words correct. Practice again to improve.`
}
