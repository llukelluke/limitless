import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, Select } from '../../components/AdminUI.jsx'
import { ACCOUNT_CATEGORIES, NORMAL_SIDES, STATEMENTS, formatMoney, isAdmin, labelFor, parseMoney } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import './Accounts.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const baseColumns = [
  { key: 'number', header: 'NUMBER', width: '9%' },
  {
    key: 'name',
    header: 'ACCOUNT NAME',
    width: '18%',
    render: (account) => (
      <Link to={`/accounts/${account.id}/ledger`} title={`Open the ledger for ${account.name}`}>
        {account.name}
      </Link>
    ),
  },
  { key: 'category', header: 'CATEGORY', width: '10%' },
  { key: 'subcategory', header: 'SUBCATEGORY', width: '14%' },
  { key: 'normal_side', header: 'NORMAL SIDE', width: '10%', render: (a) => labelFor(NORMAL_SIDES, a.normal_side) },
  {
    key: 'balance',
    header: <span className="num">BALANCE</span>,
    width: '13%',
    render: (a) => <span className="num">{formatMoney(a.balance)}</span>,
  },
  { key: 'statement', header: 'STATEMENT', width: '9%', render: (a) => labelFor(STATEMENTS, a.statement) },
  { key: 'status', header: 'STATUS', width: '8%', render: (a) => (a.active ? 'Active' : 'Inactive') },
]

const actionColumn = (admin) => ({
  key: 'action',
  header: 'ACTION',
  render: (account) => (
    <span className="table-actions">
      <Link to={`/accounts/${account.id}`} title={`View the details of ${account.name}`}>
        View →
      </Link>
      {admin && (
        <Link to={`/accounts/${account.id}/edit`} title={`Edit ${account.name}`}>
          Edit →
        </Link>
      )}
    </span>
  ),
})

// Search matches the account name or number; the other tokens narrow the list further.
function matches(account, filters) {
  const term = filters.search.trim().toLowerCase()
  const min = parseMoney(filters.min)
  const max = parseMoney(filters.max)
  const balance = Number(account.balance ?? 0)
  return (
    (!term || account.name.toLowerCase().includes(term) || String(account.number).includes(term)) &&
    (!filters.category || account.category === filters.category) &&
    (!filters.subcategory || account.subcategory === filters.subcategory) &&
    (!filters.statement || account.statement === filters.statement) &&
    (!filters.status || account.active === (filters.status === 'active')) &&
    (!filters.min.trim() || Number.isNaN(min) || balance >= min) &&
    (!filters.max.trim() || Number.isNaN(max) || balance <= max)
  )
}

const EMPTY_FILTERS = { search: '', category: '', subcategory: '', statement: '', status: '', min: '', max: '' }

// Chart of Accounts — every role can view; administrators can add, edit and deactivate.
export default function ChartOfAccounts() {
  const { user } = useAuth()
  const admin = isAdmin(user)
  const { data, error, loading } = useApi(api.listAccounts)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const accounts = data ?? []
  const subcategories = [...new Set(accounts.map((a) => a.subcategory).filter(Boolean))].sort()
  const rows = accounts.filter((account) => matches(account, filters))
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <>
      <PageHeader
        eyebrow="CHART OF ACCOUNTS"
        title="Chart of Accounts"
        subtitle={admin ? 'Add, view, edit, and deactivate accounts.' : 'View accounts and their ledgers.'}
      />

      <Panel
        title="ACCOUNTS"
        className="page-panel"
        action={
          admin && (
            <Link to="/accounts/new" className="btn btn--primary btn--sm" title="Add a new account to the chart of accounts">
              Add Account
            </Link>
          )
        }
      >
        <div className="toolbar" role="search">
          <input
            className="toolbar__search"
            type="search"
            placeholder="Search name or number..."
            aria-label="Search by account name or number"
            title="Search by account name or number"
            value={filters.search}
            onChange={set('search')}
          />
          <Select
            wrapClassName="select--inline"
            className="toolbar__filter"
            aria-label="Filter by category"
            title="Filter by category"
            options={[{ value: '', label: 'Category' }, ...ACCOUNT_CATEGORIES]}
            value={filters.category}
            onChange={set('category')}
          />
          <Select
            wrapClassName="select--inline"
            className="toolbar__filter"
            aria-label="Filter by subcategory"
            title="Filter by subcategory"
            options={[{ value: '', label: 'Subcategory' }, ...subcategories.map((s) => ({ value: s, label: s }))]}
            value={filters.subcategory}
            onChange={set('subcategory')}
          />
          <Select
            wrapClassName="select--inline"
            className="toolbar__filter"
            aria-label="Filter by statement"
            title="Filter by financial statement"
            options={[{ value: '', label: 'Statement' }, ...STATEMENTS]}
            value={filters.statement}
            onChange={set('statement')}
          />
          <Select
            wrapClassName="select--inline"
            className="toolbar__filter"
            aria-label="Filter by status"
            title="Filter by active or inactive"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={set('status')}
          />
          <input
            className="toolbar__search toolbar__amount"
            inputMode="decimal"
            placeholder="Min balance"
            aria-label="Minimum balance"
            title="Only show accounts with at least this balance"
            value={filters.min}
            onChange={set('min')}
          />
          <input
            className="toolbar__search toolbar__amount"
            inputMode="decimal"
            placeholder="Max balance"
            aria-label="Maximum balance"
            title="Only show accounts with at most this balance"
            value={filters.max}
            onChange={set('max')}
          />
          {filtered && (
            <button
              type="button"
              className="text-link"
              title="Clear the search and all filters"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </button>
          )}
        </div>

        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={[...baseColumns, actionColumn(admin)]}
            rows={rows}
            caption="Chart of accounts"
            empty={accounts.length ? 'No accounts match these filters.' : 'No accounts yet.'}
          />
        </AsyncContent>
      </Panel>
    </>
  )
}
