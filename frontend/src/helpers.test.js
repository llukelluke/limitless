// Run with `npm test`.
import assert from 'node:assert/strict'
import test from 'node:test'
import { compareValues } from './constants.js'
import { changedFields } from './eventLog.js'

const sorted = (values) => [...values].sort(compareValues)

test('sorts numbers numerically, text naturally, dates as ISO strings, blanks last', () => {
  assert.deepEqual(sorted([1000, 25, 300.5]), [25, 300.5, 1000])
  assert.deepEqual(sorted(['JE-10', 'je-2', 'JE-1']), ['JE-1', 'je-2', 'JE-10'])
  assert.deepEqual(sorted(['2026-11-01', '2026-02-15', '2025-12-31']), ['2025-12-31', '2026-02-15', '2026-11-01'])
  assert.deepEqual(sorted([null, 'b', '', 'a', undefined]), ['a', 'b', null, '', undefined])
  assert.deepEqual(sorted([false, true]), [true, false]) // active accounts first
})

test('changed fields compare formatted values, and an ADD has none', () => {
  const event = (before, after) => ({ before_image: before && JSON.stringify(before), after_image: JSON.stringify(after) })
  assert.deepEqual(changedFields(event({ name: 'Cash', balance: 100 }, { name: 'Cash', balance: 100.0 })), [])
  assert.deepEqual(changedFields(event({ name: 'Cash', balance: 100 }, { name: 'Cash on Hand', balance: 75 })), ['name', 'balance'])
  assert.deepEqual(changedFields(event(null, { name: 'Cash' })), [])
  assert.deepEqual(changedFields({ before_image: 'not json', after_image: '{"a":1}' }), [])
})
