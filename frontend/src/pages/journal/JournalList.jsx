import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, Select, StatusBadge, ToolbarField } from '../../components/AdminUI.jsx'
import { formatDate, formatMoney, isAdmin, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { JOURNAL_STATUSES, matchesEntry, sortedLines } from '../../journal.js'
import './Journal.css'

const STATUS_OPTIONS = [{ value: '', label: 'All' }, ...JOURNAL_STATUSES.filter((s) => s.value !== 'DRAFT')]

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
    header: 'REF',
    width: '8%',
    render: (e) => (
      <Link to={`/journal/${e.id}`} title="Open this journal entry">
        JE-{e.id}
      </Link>
    ),
  },
  { key: 'entry_date', header: 'DATE', width: '11%', render: (e) => formatDate(e.entry_date) },
  {
    key: 'accounts',
    header: 'ACCOUNTS',
    sortValue: (e) => sortedLines(e)[0]?.account_name,
    width: '26%',
    render: (e) =>
      lineCells(e, (line) => (
        <Link to={`/accounts/${line.account_id}/ledger`} title={`Open the ledger for ${line.account_name}`}>
          {line.account_name}
        </Link>
      )),
  },
  { key: 'debit', header: <span className="num">DEBIT</span>, width: '13%', sortValue: (e) => e.total_debits, render: (e) => lineCells(e, amount('DEBIT')) },
  { key: 'credit', header: <span className="num">CREDIT</span>, width: '13%', sortValue: (e) => e.total_credits, render: (e) => lineCells(e, amount('CREDIT')) },
  { key: 'status', header: 'STATUS', width: '10%', render: (e) => <JournalStatus status={e.status} /> },
  { key: 'created_by_name', header: 'PREPARED BY', width: '11%' },
  {
    key: 'action',
    header: 'ACTION',
    render: (e) => (
      <Link to={`/journal/${e.id}`} title="View this journal entry">
        View →
      </Link>
    ),
  },
]

// Journal — every entry with its status; filter by status and date, search by account, amount or date.
export default function JournalList() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const { data, error, loading } = useApi(api.listJournalEntries)
  const [filters, setFilters] = useState({ search: '', from: '', to: '' })

  const entries = data ?? []
  const rows = entries
    .filter((entry) => (!status || entry.status === status) && matchesEntry(entry, filters))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id)
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const filtered = status || filters.search || filters.from || filters.to

  return (
    <>
      <PageHeader
        eyebrow="JOURNALIZING"
        title="Journal"
        subtitle="Journal entries and their approval status. Approved entries post to the ledger."
      />

      <Panel
        title="JOURNAL ENTRIES"
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
          <ToolbarField label="STATUS">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by status"
              title="Show pending, approved or rejected entries"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {})}
            />
          </ToolbarField>
          <ToolbarField label="SEARCH">
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
          <ToolbarField label="FROM">
            <input className="toolbar__search toolbar__date" type="date" aria-label="From date" title="Only entries on or after this date" value={filters.from} onChange={set('from')} />
          </ToolbarField>
          <ToolbarField label="TO">
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
