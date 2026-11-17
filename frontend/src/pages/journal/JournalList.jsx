import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, Select, StatusBadge, ToolbarField } from '../../components/AdminUI.jsx'
import { formatDate, formatMoney, isAdmin, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { ENTRY_TYPES, JOURNAL_STATUSES, matchesEntry, sortedLines } from '../../journal.js'
import './Journal.css'

const STATUS_OPTIONS = [{ value: '', label: 'All' }, ...JOURNAL_STATUSES.filter((s) => s.value !== 'DRAFT')]
const TYPE_OPTIONS = [{ value: '', label: 'All' }, ...ENTRY_TYPES]

// One line per account, debits first; credits are indented as on paper.
const lineCells = (entry, render) => (
  <ul className="journal-lines">
    {sortedLines(entry).map((line) => (
      <li key={line.id} className={line.side === 'CREDIT' ? 'journal-lines__credit' : undefined}>
        {render(line)}
      </li>
    ))}
  </ul>
)

const amount = (side) => (line) => <span className="num">{line.side === side ? formatMoney(line.amount) : ' '}</span>

export function JournalStatus({ status }) {
  return (
    <StatusBadge status={status} className="journal-status">
      {labelFor(JOURNAL_STATUSES, status)}
    </StatusBadge>
  )
}

const columns = [
  {
    key: 'id',
    header: 'Ref',
    width: '8%',
    render: (e) => (
      <Link to={`/journal/${e.id}`} title="Open this journal entry">
        JE-{e.id}
      </Link>
    ),
  },
  { key: 'entry_date', header: 'Date', width: '11%', render: (e) => formatDate(e.entry_date) },
  {
    key: 'accounts',
    header: 'Accounts',
    sortValue: (e) => sortedLines(e)[0]?.account_name,
    width: '22%',
    render: (e) =>
      lineCells(e, (line) => (
        <Link to={`/accounts/${line.account_id}/ledger`} title={`Open the ledger for ${line.account_name}`}>
          {line.account_name}
        </Link>
      )),
  },
  { key: 'debit', header: <span className="num">Debit</span>, width: '11%', sortValue: (e) => e.total_debits, render: (e) => lineCells(e, amount('DEBIT')) },
  { key: 'credit', header: <span className="num">Credit</span>, width: '11%', sortValue: (e) => e.total_credits, render: (e) => lineCells(e, amount('CREDIT')) },
  { key: 'entry_type', header: 'Type', width: '9%', render: (e) => labelFor(ENTRY_TYPES, e.entry_type) },
  { key: 'status', header: 'Status', width: '10%', render: (e) => <JournalStatus status={e.status} /> },
  { key: 'created_by_name', header: 'Prepared by', width: '11%' },
  {
    key: 'action',
    header: 'Action',
    render: (e) => (
      <Link to={`/journal/${e.id}`} title="View this journal entry">
        View →
      </Link>
    ),
  },
]

// Journal — every entry with its status; filter by status, type (regular / adjusting) and date,
// search by account, amount or date. Status and type live in the URL so other pages can link to them.
export default function JournalList() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''
  const setParam = (key) => (event) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (event.target.value) next.set(key, event.target.value)
      else next.delete(key)
      return next
    })
  const { data, error, loading } = useApi(api.listJournalEntries)
  const [filters, setFilters] = useState({ search: '', from: '', to: '' })

  const entries = data ?? []
  const rows = entries
    .filter((entry) => (!status || entry.status === status) && (!type || entry.entry_type === type) && matchesEntry(entry, filters))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id)
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const filtered = status || type || filters.search || filters.from || filters.to

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Journal entries and their approval status. Approved entries post to the ledger."
      />

      <Panel
        title="Journal entries"
        className="page-panel"
        action={
          !isAdmin(user) && (
            <Link to="/journal/new" className="btn btn--primary btn--sm" title="Prepare a new journal entry">
              New Journal Entry
            </Link>
          )
        }
      >
        <div className="toolbar" role="search">
          <ToolbarField label="Status">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by status"
              title="Show pending, approved or rejected entries"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setParam('status')}
            />
          </ToolbarField>
          <ToolbarField label="Type">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by entry type"
              title="Show regular or adjusting entries"
              options={TYPE_OPTIONS}
              value={type}
              onChange={setParam('type')}
            />
          </ToolbarField>
          <ToolbarField label="Search">
            <input
              className="toolbar__search"
              type="search"
              placeholder="Account, amount or date"
              aria-label="Search by account name, amount or date"
              title="Search by account name, amount or date"
              value={filters.search}
              onChange={set('search')}
            />
          </ToolbarField>
          <ToolbarField label="From">
            <input className="toolbar__search toolbar__date" type="date" aria-label="From date" title="Only entries on or after this date" value={filters.from} onChange={set('from')} />
          </ToolbarField>
          <ToolbarField label="To">
            <input className="toolbar__search toolbar__date" type="date" aria-label="To date" title="Only entries on or before this date" value={filters.to} onChange={set('to')} />
          </ToolbarField>
          {filtered && (
            <button
              type="button"
              className="text-link"
              title="Clear the search and all filters"
              onClick={() => {
                setFilters({ search: '', from: '', to: '' })
                setParams({})
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={columns}
            rows={rows}
            caption="Journal entries"
            empty={entries.length ? 'No journal entries match these filters.' : 'No journal entries yet.'}
          />
        </AsyncContent>
      </Panel>
    </>
  )
}
