import { formatDate, parseMoney } from './constants.js'

// SUBMITTED is what the backend calls "pending approval".
export const JOURNAL_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export const ENTRY_TYPES = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'ADJUSTING', label: 'Adjusting' },
]

// Source documents: pdf, word, excel, csv, jpg, png.
export const ATTACHMENT_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png']

// Request body for create/validate. Amounts go to the server as typed so it can report
// "more than two decimals" or "missing amount" with its own error_messages text.
export function toRequest(draft) {
  const amount = (text) => {
    const plain = String(text).replace(/[$,\s]/g, '')
    return plain === '' || Number.isNaN(Number(plain)) ? null : Number(plain)
  }
  const lines = ['DEBIT', 'CREDIT'].flatMap((side) =>
    draft.lines
      .filter((line) => line.side === side)
      .map((line) => ({ account_id: line.account_id ? Number(line.account_id) : null, side, amount: amount(line.amount) })),
  )
  return { ...draft, entry_date: draft.entry_date || null, description: draft.description.trim() || null, lines }
}

// Debits come before credits.
export const sortedLines = (entry) =>
  [...entry.lines].sort((a, b) => (a.side === b.side ? 0 : a.side === 'DEBIT' ? -1 : 1))

export const entryTotal = (entry) =>
  entry.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0)

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
