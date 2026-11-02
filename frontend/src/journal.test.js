// Run with `npm test` (node's built-in runner; no backend needed).
import assert from 'node:assert/strict'
import test from 'node:test'
import { ledgerRows, matchesEntry, validateEntry } from './journal.js'

const line = (side, account_id, amount) => ({ side, account_id, amount })
const codes = (problems) => problems.map((p) => p.code)

test('a balanced entry has no problems', () => {
  const draft = { entry_date: '2026-11-02', lines: [line('LEFT', 1, '0.10'), line('LEFT', 2, '0.20'), line('RIGHT', 3, '0.30')] }
  assert.deepEqual(validateEntry(draft), [])
})

test('flags missing pieces and unbalanced totals', () => {
  assert.deepEqual(codes(validateEntry({ entry_date: '', lines: [] })), ['JE_001', 'JE_004', 'JE_005'])
  const unbalanced = validateEntry({ entry_date: '2026-11-02', lines: [line('LEFT', 1, '100'), line('RIGHT', 2, '90')] })
  assert.deepEqual(codes(unbalanced), ['JE_006'])
  assert.match(unbalanced[0].extra, /\$10\.00/)
})

test('flags bad lines, duplicate accounts and file types', () => {
  const draft = { entry_date: '2026-11-02', lines: [line('LEFT', '', 'abc'), line('LEFT', 1, '5'), line('RIGHT', 1, '5')] }
  const problems = validateEntry(draft, [{ name: 'virus.exe' }, { name: 'receipt.PDF' }])
  assert.deepEqual(codes(problems), ['JE_002', 'JE_003', 'JE_007', 'JE_008'])
  assert.equal(problems[0].where, 'Debit line 1')
  assert.equal(problems[2].where, 'Credit line 1')
})

test('ledger keeps a running balance on the normal side, approved entries only', () => {
  const cash = { id: 1, normal_side: 'LEFT', initial_balance: 100, added_at: '2026-01-01T09:00:00' }
  const entry = (id, status, date, side, amount) => ({
    id, status, entry_date: date, lines: [{ id, account_id: 1, account_name: 'Cash', side, amount }],
  })
  const rows = ledgerRows(cash, [
    entry(2, 'APPROVED', '2026-02-01', 'RIGHT', 30),
    entry(1, 'APPROVED', '2026-01-15', 'LEFT', 50.5),
    entry(3, 'PENDING', '2026-01-20', 'LEFT', 999),
  ])
  assert.deepEqual(rows.map((r) => r.balance), [100, 150.5, 120.5])
  assert.deepEqual(rows.map((r) => r.entry_id), [undefined, 1, 2])

  const loan = { ...cash, normal_side: 'RIGHT' }
  assert.deepEqual(ledgerRows(loan, [entry(1, 'APPROVED', '2026-01-15', 'LEFT', 40)]).map((r) => r.balance), [100, 60])
})

test('journal search matches account name, amount, or date', () => {
  const entry = { entry_date: '2026-11-02', lines: [{ account_name: 'Cash', side: 'LEFT', amount: 1250 }] }
  for (const search of ['cash', '1,250', '$1250.00', '2026-11', 'nov. 2']) assert.ok(matchesEntry(entry, { search }), search)
  assert.ok(!matchesEntry(entry, { search: 'rent' }))
  assert.ok(!matchesEntry(entry, { from: '2026-11-03' }))
})
