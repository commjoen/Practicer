import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPracticeQueue,
  createScoreSummary,
  isCorrectAnswer,
  normalizeAnswer
} from './session.js'

const lessons = [
  {
    id: 'one',
    name: 'Lesson one',
    words: [{ prompt: 'cat', answer: 'gato' }]
  },
  {
    id: 'two',
    name: 'Lesson two',
    words: [{ prompt: 'dog', answer: 'perro' }]
  }
]

test('normalizeAnswer trims, lowers case, and collapses spaces', () => {
  assert.equal(normalizeAnswer('  Ho  La  '), 'ho la')
})

test('isCorrectAnswer ignores casing and surrounding whitespace', () => {
  assert.equal(isCorrectAnswer('  GATO ', 'gato'), true)
})

test('buildPracticeQueue combines words from selected lessons', () => {
  assert.deepEqual(buildPracticeQueue(lessons, ['one', 'two']), [
    {
      lessonId: 'one',
      lessonName: 'Lesson one',
      prompt: 'cat',
      answer: 'gato'
    },
    {
      lessonId: 'two',
      lessonName: 'Lesson two',
      prompt: 'dog',
      answer: 'perro'
    }
  ])
})

test('buildPracticeQueue requires at least one lesson', () => {
  assert.throws(
    () => buildPracticeQueue(lessons, []),
    /Select at least one lesson/
  )
})

test('createScoreSummary returns a friendly score message', () => {
  assert.match(createScoreSummary(2, 3), /Great job! 2\/3 words correct\./)
})

test('createScoreSummary celebrates a perfect score', () => {
  assert.match(
    createScoreSummary(3, 3),
    /Perfect score! 3\/3 words correct\./
  )
})

test('createScoreSummary encourages more practice for lower scores', () => {
  assert.match(
    createScoreSummary(1, 3),
    /Nice try! 1\/3 words correct\. Practice again to improve\./
  )
})

test('createScoreSummary handles zero questions', () => {
  assert.match(
    createScoreSummary(0, 0),
    /Pick a lesson to start your first practice round\./
  )
})
