// Run with `npm test` (node's built-in runner; no backend needed).
import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesEntry, toRequest } from './journal.js'

test('request body lists debits first and leaves bad input for the server to report', () => {
  const draft = {
    entry_date: '',
    entry_type: 'REGULAR',
    description: '  ',
    lines: [
      { key: 1, side: 'CREDIT', account_id: '3', amount: '$1,250.00' },
      { key: 2, side: 'DEBIT', account_id: '', amount: 'abc' },
      { key: 3, side: 'DEBIT', account_id: '2', amount: '1.234' },
    ],
  }
  assert.deepEqual(toRequest(draft), {
    entry_date: null,
    entry_type: 'REGULAR',
    description: null,
    lines: [
      { account_id: null, side: 'DEBIT', amount: null },
      { account_id: 2, side: 'DEBIT', amount: 1.234 },
      { account_id: 3, side: 'CREDIT', amount: 1250 },
    ],
  })
})

test('journal search matches account name, amount, or date', () => {
  const entry = { entry_date: '2026-11-02', lines: [{ account_name: 'Cash', side: 'DEBIT', amount: 1250 }] }
  for (const search of ['cash', '1,250', '$1250.00', '2026-11', 'nov. 2']) assert.ok(matchesEntry(entry, { search }), search)
  assert.ok(!matchesEntry(entry, { search: 'rent' }))
  assert.ok(!matchesEntry(entry, { from: '2026-11-03' }))
})
