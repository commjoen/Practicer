import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildShortcutSearch,
  parseShortcutParams,
  resolveShortcutAction
} from './url-state.js'

test('parseShortcutParams reads practice shortcuts from query params', () => {
  assert.deepEqual(
    parseShortcutParams(
      '?pack=dutch-english&direction=target-to-source&lessons=one,two&practice=1'
    ),
    {
      languagePackId: 'dutch-english',
      direction: 'target-to-source',
      selectedLessonIds: ['one', 'two'],
      lessonId: '',
      lessonPage: 0,
      startPractice: true
    }
  )
})

test('parseShortcutParams normalizes invalid direction and page values', () => {
  assert.deepEqual(parseShortcutParams('?direction=invalid&page=0'), {
    languagePackId: '',
    direction: 'source-to-target',
    selectedLessonIds: [],
    lessonId: '',
    lessonPage: 0,
    startPractice: false
  })
})

test('buildShortcutSearch writes preview shortcuts', () => {
  assert.equal(
    buildShortcutSearch({
      languagePackId: 'spanish-english',
      direction: 'source-to-target',
      selectedLessonIds: ['animals'],
      lessonId: 'animals',
      lessonPage: 1
    }),
    '?pack=spanish-english&direction=source-to-target&lessons=animals&lesson=animals&page=2'
  )
})

test('buildShortcutSearch writes practice shortcuts', () => {
  assert.equal(
    buildShortcutSearch({
      languagePackId: 'dutch-english',
      direction: 'target-to-source',
      selectedLessonIds: ['dutch-lesson-1'],
      startPractice: true
    }),
    '?pack=dutch-english&direction=target-to-source&lessons=dutch-lesson-1&practice=1'
  )
})

test('resolveShortcutAction requires explicit lessons for practice shortcuts', () => {
  assert.deepEqual(
    resolveShortcutAction({ startPractice: true, selectedLessonIds: [] }),
    {
      type: 'picker',
      message: 'Select at least one lesson to start practicing.'
    }
  )
})

test('resolveShortcutAction rejects preview shortcut with invalid requested pack', () => {
  assert.deepEqual(
    resolveShortcutAction({
      requestedPackId: 'missing-pack',
      hasValidRequestedPack: false,
      lessonId: 'animals',
      lessonExistsInPack: true
    }),
    { type: 'picker', message: 'Lesson not found.' }
  )
})
