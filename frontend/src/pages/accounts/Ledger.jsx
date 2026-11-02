import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, DataTable, PageHeader, Panel, ToolbarField } from '../../components/AdminUI.jsx'
import { NORMAL_SIDES, formatDate, formatMoney, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { ledgerRows, matchesLedgerRow } from '../../journal.js'
import './Accounts.css'

const money = (key) => ({
  key,
  header: <span className="num">{key.toUpperCase()}</span>,
  width: '15%',
  render: (row) => <span className="num">{row[key] === null ? '' : formatMoney(row[key])}</span>,
})

const columns = [
  { key: 'date', header: 'DATE', width: '14%', render: (row) => formatDate(row.date) },
  { key: 'description', header: 'DESCRIPTION', width: '33%' },
  {
    key: 'pr',
    header: 'PR',
    width: '8%',
    render: (row) =>
      row.entry_id && (
        <Link to={`/journal/${row.entry_id}`} title="Open the journal entry that made this posting">
          JE-{row.entry_id}
        </Link>
      ),
  },
  money('debit'),
  money('credit'),
  money('balance'),
]

const EMPTY_FILTERS = { search: '', from: '', to: '' }

// Account ledger: opening balance, then each approved journal entry posting with a running balance.
export default function Ledger() {
  const { id } = useParams()
  const { data: account, error, loading } = useApi(() => api.getAccount(id), [id])
  const journal = useApi(() => api.listJournalEntries({ status: 'APPROVED', account_id: id }), [id])
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const allRows = account && journal.data ? ledgerRows(account, journal.data) : []
  const rows = allRows.filter((row) => matchesLedgerRow(row, filters))
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const filtered = filters.search || filters.from || filters.to
  return (
    <>
      <PageHeader
        eyebrow="LEDGER"
        title={account ? `${account.number} · ${account.name}` : 'Ledger'}
        subtitle="Every posting to this account, with a running balance."
      />

      <Panel
        title="LEDGER"
        className="page-panel"
        action={<BackLink to="/accounts">Back to Chart of Accounts</BackLink>}
      >
        <AsyncContent loading={loading && !account} error={error}>
          {account && (
            <>
              <dl className="ledger-summary">
                <div>
                  <dt>NORMAL SIDE</dt>
                  <dd>{labelFor(NORMAL_SIDES, account.normal_side)}</dd>
                </div>
                <div>
                  <dt>TOTAL DEBITS</dt>
                  <dd>{formatMoney(account.debit)}</dd>
                </div>
                <div>
                  <dt>TOTAL CREDITS</dt>
                  <dd>{formatMoney(account.credit)}</dd>
                </div>
                <div>
                  <dt>BALANCE</dt>
                  <dd>{formatMoney(account.balance)}</dd>
                </div>
              </dl>
              <div className="toolbar" role="search">
                <ToolbarField label="SEARCH">
                  <input
                    className="toolbar__search"
                    type="search"
                    placeholder="Account name or amount"
                    aria-label="Search by account name or amount"
                    title="Search by account name (any account in the entry) or amount"
                    value={filters.search}
                    onChange={set('search')}
                  />
                </ToolbarField>
                <ToolbarField label="FROM">
                  <input className="toolbar__search toolbar__date" type="date" aria-label="From date" title="Only postings on or after this date" value={filters.from} onChange={set('from')} />
                </ToolbarField>
                <ToolbarField label="TO">
                  <input className="toolbar__search toolbar__date" type="date" aria-label="To date" title="Only postings on or before this date" value={filters.to} onChange={set('to')} />
                </ToolbarField>
                {filtered && (
                  <button type="button" className="text-link" title="Clear the search and dates" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </button>
                )}
              </div>
              <AsyncContent loading={journal.loading && !journal.data} error={journal.error}>
                <DataTable
                  columns={columns}
                  rows={rows}
                  caption={`Ledger for ${account.name}`}
                  empty="No postings match these filters."
                />
              </AsyncContent>
            </>
          )}
        </AsyncContent>
      </Panel>
    </>
  )
}
