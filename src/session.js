export function normalizeAnswer(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function isCorrectAnswer(answer, expectedAnswer) {
  return normalizeAnswer(answer) === normalizeAnswer(expectedAnswer)
}

export function buildPracticeQueue(lessons, selectedLessonIds) {
  const selected = lessons.filter(({ id }) => selectedLessonIds.includes(id))

  if (selected.length === 0) {
    throw new Error('Select at least one lesson to start practicing.')
  }

  return selected.flatMap((lesson) =>
    lesson.words.map((word) => ({
      lessonId: lesson.id,
      lessonName: lesson.name,
      prompt: word.prompt,
      answer: word.answer
    }))
  )
}

export function createScoreSummary(correctAnswers, totalQuestions) {
  const percentage = Math.round((correctAnswers / totalQuestions) * 100)

  if (percentage === 100) {
    return `Perfect score! ${correctAnswers}/${totalQuestions} words correct.`
  }

  if (percentage >= 60) {
    return `Great job! ${correctAnswers}/${totalQuestions} words correct.`
  }

  return `Nice try! ${correctAnswers}/${totalQuestions} words correct. Practice again to improve.`
}
