// Run with `npm test`.
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRatio, gauge, normalizePrefs, visibleRatios } from './ratios.js'

test('formats each unit', () => {
  assert.equal(formatRatio({ value: 0.1234, unit: 'percent' }), '12.3%')
  assert.equal(formatRatio({ value: 41.6, unit: 'days' }), '42 days')
  assert.equal(formatRatio({ value: 3, unit: 'times' }), '3.00×')
  assert.equal(formatRatio({ value: 1.5, unit: 'ratio' }), '1.50')
  assert.equal(formatRatio({ value: null, unit: 'ratio' }), '—')
})

test('gauge runs red→green when higher is better and green→red when lower is better', () => {
  const up = gauge({ value: 3, higherIsBetter: true, good: 1.5, warn: 1.0 })
  assert.deepEqual(up.stops.map(([, tone]) => tone), ['bad', 'warning', 'good'])
  assert.equal(up.max, 2.25)
  assert.equal(up.value, 2.25) // clamped to the end of the scale
  assert.deepEqual(up.stops.map(([at]) => Number(at.toFixed(3))), [0.444, 0.667, 1])
  const down = gauge({ value: -1, higherIsBetter: false, good: 0.4, warn: 0.6 })
  assert.deepEqual(down.stops.map(([, tone]) => tone), ['good', 'warning', 'bad'])
  assert.equal(down.value, 0)
})

test('by default only ratios with a value are shown; a saved choice wins', () => {
  const ratios = [{ key: 'a', value: 1 }, { key: 'b', value: null }]
  assert.deepEqual(visibleRatios(ratios, null).map((r) => r.key), ['a'])
  assert.deepEqual(visibleRatios(ratios, ['b']).map((r) => r.key), ['b'])
})

test('saved choices: defaults, old charts on/off becomes gauge / none, unknown chart types are dropped', () => {
  const empty = { types: {}, order: [] }
  assert.deepEqual(normalizePrefs(null), { selected: null, chart: 'gauge', ...empty })
  assert.deepEqual(normalizePrefs({ selected: ['a'], charts: false }), { selected: ['a'], chart: 'none', ...empty })
  assert.equal(normalizePrefs({ chart: 'pie' }).chart, 'gauge')
  assert.deepEqual(normalizePrefs({ types: { a: 'bar', b: 'pie' } }).types, { a: 'bar' })
})
