import { formatDate, formatMoney, parseMoney } from './constants.js'

export const JOURNAL_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export const ENTRY_TYPES = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'ADJUSTING', label: 'Adjusting' },
]

// Source documents: pdf, word, excel, csv, jpg, png.
export const ATTACHMENT_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png']

// The real text lives in the error_messages table (GET /api/error-messages); these are used
// only until it loads or if a code is missing there. Keep in sync with API_CONTRACT.md.
export const ERROR_FALLBACKS = {
  JE_001: 'Enter the date of the journal entry.',
  JE_002: 'Choose an account from the chart of accounts.',
  JE_003: 'Enter an amount greater than zero, with at most two decimal places.',
  JE_004: 'A journal entry needs at least one debit.',
  JE_005: 'A journal entry needs at least one credit.',
  JE_006: 'Total debits must equal total credits.',
  JE_007: 'Each account can appear only once in a journal entry.',
  JE_008: 'Attachments must be PDF, Word, Excel, CSV, JPG, or PNG files.',
  JE_009: 'Enter a reason in the comment field when rejecting a journal entry.',
}

const SIDE_LABEL = { LEFT: 'Debit', RIGHT: 'Credit' }

const extension = (name) => name.split('.').pop().toLowerCase()

// Problems in a draft entry, in the order the user should fix them.
// Each is { code, where?, extra? }; the page shows "where: <message for code> extra".
export function validateEntry(draft, files = []) {
  const problems = []
  if (!draft.entry_date) problems.push({ code: 'JE_001' })

  const totals = { LEFT: 0, RIGHT: 0 }
  const counts = { LEFT: 0, RIGHT: 0 }
  const seen = new Set()
  for (const side of ['LEFT', 'RIGHT']) {
    draft.lines
      .filter((line) => line.side === side)
      .forEach((line, index) => {
        const where = `${SIDE_LABEL[side]} line ${index + 1}`
        const amount = parseMoney(line.amount)
        if (!line.account_id) problems.push({ code: 'JE_002', where })
        else if (seen.has(line.account_id)) problems.push({ code: 'JE_007', where })
        if (!(amount > 0)) problems.push({ code: 'JE_003', where })
        if (line.account_id) seen.add(line.account_id)
        if (amount > 0) totals[side] += amount
        counts[side] += 1
      })
  }

  if (!counts.LEFT) problems.push({ code: 'JE_004' })
  if (!counts.RIGHT) problems.push({ code: 'JE_005' })
  // Compare in cents so 0.1 + 0.2 still balances 0.3
  const debits = Math.round(totals.LEFT * 100)
  const credits = Math.round(totals.RIGHT * 100)
  if (counts.LEFT && counts.RIGHT && debits !== credits) {
    problems.push({
      code: 'JE_006',
      extra: `Debits ${formatMoney(debits / 100)}, credits ${formatMoney(credits / 100)}: off by ${formatMoney(Math.abs(debits - credits) / 100)}.`,
    })
  }

  for (const file of files) {
    if (!ATTACHMENT_TYPES.includes(extension(file.name))) problems.push({ code: 'JE_008', where: file.name })
  }
  return problems
}

// Debits come before credits.
export const sortedLines = (entry) =>
  [...entry.lines].sort((a, b) => (a.side === b.side ? 0 : a.side === 'LEFT' ? -1 : 1))

export const entryTotal = (entry) =>
  entry.lines.filter((line) => line.side === 'LEFT').reduce((sum, line) => sum + Number(line.amount), 0)

// Ledger for one account: the opening balance, then every line of its approved entries
// (oldest first) with a running balance on the account's normal side.
export function ledgerRows(account, entries) {
  const sign = account.normal_side === 'LEFT' ? 1 : -1
  let balance = Number(account.initial_balance ?? 0)
  const rows = [
    {
      id: 'opening',
      date: account.added_at?.slice(0, 10),
      description: 'Opening balance',
      debit: account.normal_side === 'LEFT' ? balance : null,
      credit: account.normal_side === 'RIGHT' ? balance : null,
      balance,
      accounts: [],
    },
  ]
  const approved = entries
    .filter((entry) => entry.status === 'APPROVED')
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id)
  for (const entry of approved) {
    for (const line of entry.lines.filter((l) => l.account_id === account.id)) {
      const amount = Number(line.amount)
      const debit = line.side === 'LEFT' ? amount : null
      const credit = line.side === 'RIGHT' ? amount : null
      balance = Math.round((balance + sign * ((debit ?? 0) - (credit ?? 0))) * 100) / 100
      rows.push({
        id: `${entry.id}-${line.id}`,
        entry_id: entry.id,
        date: entry.entry_date,
        description: entry.description ?? '',
        debit,
        credit,
        balance,
        accounts: entry.lines.map((l) => l.account_name),
      })
    }
  }
  return rows
}

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to)

const amountMatches = (term, amounts) => {
  const amount = parseMoney(term)
  return term !== '' && !Number.isNaN(amount) && amounts.some((value) => value !== null && Number(value) === amount)
}

// Journal search: account name, amount, or date ("2026-11-02" or "Nov. 2").
export function matchesEntry(entry, { search = '', from = '', to = '' }) {
  const term = search.trim().toLowerCase()
  const textMatch =
    !term ||
    entry.lines.some((line) => line.account_name.toLowerCase().includes(term)) ||
    amountMatches(term, [...entry.lines.map((line) => line.amount), entryTotal(entry)]) ||
    entry.entry_date.includes(term) ||
    formatDate(entry.entry_date).toLowerCase().includes(term)
  return textMatch && inRange(entry.entry_date, from, to)
}

// Ledger search: account name (any account in the posting's entry) or amount.
export function matchesLedgerRow(row, { search = '', from = '', to = '' }) {
  const term = search.trim().toLowerCase()
  const textMatch =
    !term ||
    row.accounts.some((name) => name.toLowerCase().includes(term)) ||
    amountMatches(term, [row.debit, row.credit, row.balance])
  return textMatch && inRange(row.date ?? '', from, to)
}
