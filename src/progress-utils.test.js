import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLessonHighScoreStorageKey,
  formatElapsedTime,
  getScorePercentage
} from './progress-utils.js'

test('buildLessonHighScoreStorageKey includes pack direction and lesson', () => {
  assert.equal(
    buildLessonHighScoreStorageKey('dutch-english', 'target-to-source', 'dutch-lesson-1'),
    'practicer:highScore:dutch-english:target-to-source:dutch-lesson-1'
  )
})

test('getScorePercentage rounds score percentages', () => {
  assert.equal(getScorePercentage(2, 3), 67)
})

test('getScorePercentage returns zero when no questions were asked', () => {
  assert.equal(getScorePercentage(1, 0), 0)
})

test('formatElapsedTime renders minutes and seconds', () => {
  assert.equal(formatElapsedTime(75), '01:15')
})

test('formatElapsedTime renders hour-aware values', () => {
  assert.equal(formatElapsedTime(3661), '1:01:01')
})
