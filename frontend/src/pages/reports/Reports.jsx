import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import {
  AccountStatus,
  DataTable,
  PageHeader,
  Panel,
  ReportActions,
  ReportCard,
  ReportMeta,
  Select,
  StatusBadge,
  ToolbarField,
} from '../../components/AdminUI.jsx'
import { NORMAL_SIDES, STATEMENTS, formatDate, formatDateTime, formatMoney, isAdmin, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { JOURNAL_STATUSES, matchesEntry, sortedLines } from '../../journal.js'
import { ACTIONS, changedFields } from '../../eventLog.js'

const money = (key, header, width) => ({
  key,
  header: <span className="num">{header}</span>,
  width,
  render: (row) => <span className="num">{formatMoney(row[key])}</span>,
})
const total = (rows, key) => rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)
const num = (value) => <span className="num">{formatMoney(value)}</span>

// Reports — financial reports for every role; user reports for administrators.
export function ReportsHome() {
  const { user } = useAuth()
  return (
    <>
      <PageHeader title="Reports" subtitle="View and print reports. Every report has a Print button." />
      {user.role === 'MANAGER' && (
        <Panel title="Financial statements" className="page-panel">
          <div className="report-cards">
            <ReportCard
              label="Financial statements"
              description="Trial balance, income statement, balance sheet and retained earnings statement for a date or date range. Save, email or print."
              linkTo="/reports/statements"
            />
          </div>
        </Panel>
      )}
      <Panel title="Financial reports" className="page-panel">
        <div className="report-cards">
          <ReportCard label="Chart of accounts" description="Every account with its category, normal side, debits, credits and balance." linkTo="/reports/accounts" />
          <ReportCard label="Journal entries" description="Journal entries by status and date range, with totals." linkTo="/reports/journal" />
          <ReportCard label="Event log" description="Every change to accounts and journal entries, by date and user." linkTo="/reports/event-log" />
        </div>
      </Panel>
      {isAdmin(user) && (
        <Panel title="User reports" className="page-panel">
          <div className="report-cards">
            <ReportCard label="All users" description="View all registered users and account information." linkTo="/admin/reports/users" />
            <ReportCard label="Users by status & role" description="User counts by role and status, plus suspended and deactivated users." linkTo="/admin/reports/users-by-status" />
            <ReportCard label="Expired passwords" description="View users with expired passwords requiring attention." linkTo="/admin/reports/expired-passwords" />
          </div>
        </Panel>
      )}
    </>
  )
}

const accountColumns = [
  { key: 'number', header: 'Number', width: '9%', render: (a) => <Link to={`/accounts/${a.id}/ledger`} title={`Open the ledger for ${a.name}`}>{a.number}</Link> },
  { key: 'name', header: 'Account', width: '17%', render: (a) => <Link to={`/accounts/${a.id}/ledger`} title={`Open the ledger for ${a.name}`}>{a.name}</Link> },
  { key: 'category', header: 'Category', width: '9%' },
  { key: 'subcategory', header: 'Subcategory', width: '13%' },
  { key: 'normal_side', header: 'Normal side', width: '8%', render: (a) => labelFor(NORMAL_SIDES, a.normal_side) },
  money('debit', 'DEBITS', '11%'),
  money('credit', 'CREDITS', '11%'),
  money('balance', 'BALANCE', '11%'),
  { key: 'statement', header: 'Statement', width: '6%', render: (a) => labelFor(STATEMENTS, a.statement) },
  { key: 'status', header: 'Status', render: (a) => <AccountStatus account={a} />, sortValue: (a) => a.active },
]

export function ChartOfAccountsReport() {
  const { data, error, loading } = useApi(api.listAccounts)
  const rows = [...(data ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.number - b.number)
  return (
    <>
      <PageHeader title="Chart of Accounts Report" subtitle="Every account in the chart of accounts." />
      <Panel title="Chart of accounts" className="page-panel" action={<ReportActions />}>
        <ReportMeta>{rows.length} accounts</ReportMeta>
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={accountColumns}
            rows={rows}
            caption="Chart of accounts report"
            empty="No accounts yet."
            footer={rows.length ? { name: 'Totals', debit: num(total(rows, 'debit')), credit: num(total(rows, 'credit')) } : undefined}
          />
        </AsyncContent>
      </Panel>
    </>
  )
}

const journalColumns = [
  { key: 'id', header: 'Ref', width: '7%', render: (e) => <Link to={`/journal/${e.id}`}>JE-{e.id}</Link> },
  { key: 'entry_date', header: 'Date', width: '11%', render: (e) => formatDate(e.entry_date) },
  {
    key: 'accounts',
    header: 'Accounts (debits first)',
    width: '30%',
    sortValue: (e) => sortedLines(e)[0]?.account_name,
    render: (e) =>
      sortedLines(e).map((line, i) => (
        <Fragment key={i}>
          {i > 0 && ', '}
          {line.side === 'CREDIT' && '    '}
          <Link to={`/accounts/${line.account_id}/ledger`} title={`Open the ledger for ${line.account_name}`}>{line.account_name}</Link>
        </Fragment>
      )),
  },
  { key: 'entry_type', header: 'Type', width: '9%', render: (e) => (e.entry_type === 'ADJUSTING' ? 'Adjusting' : 'Regular') },
  { key: 'status', header: 'Status', width: '10%', render: (e) => <StatusBadge status={e.status}>{labelFor(JOURNAL_STATUSES, e.status)}</StatusBadge> },
  { key: 'created_by_name', header: 'Prepared by', width: '14%' },
  money('total_debits', 'DEBITS', '9.5%'),
  money('total_credits', 'CREDITS', '9.5%'),
]

const ALL = { value: '', label: 'All' }

export function JournalReport() {
  const { data, error, loading } = useApi(api.listJournalEntries)
  const [filters, setFilters] = useState({ status: '', from: '', to: '' })
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const rows = (data ?? [])
    .filter((e) => e.status !== 'DRAFT' && (!filters.status || e.status === filters.status) && matchesEntry(e, filters))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id)
  const range = filters.from || filters.to
    ? `${filters.from ? formatDate(filters.from) : 'start'} to ${filters.to ? formatDate(filters.to) : 'today'}`
    : 'all dates'
  return (
    <>
      <PageHeader title="Journal Entries Report" subtitle="Journal entries by status and date range." />
      <Panel title="Journal entries" className="page-panel" action={<ReportActions />}>
        <div className="toolbar" role="search">
          <ToolbarField label="Status">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by status"
              title="Show pending, approved or rejected entries"
              options={[ALL, ...JOURNAL_STATUSES.filter((s) => s.value !== 'DRAFT')]}
              value={filters.status}
              onChange={set('status')}
            />
          </ToolbarField>
          <ToolbarField label="From">
            <input className="toolbar__search toolbar__date" type="date" aria-label="From date" title="Only entries on or after this date" value={filters.from} onChange={set('from')} />
          </ToolbarField>
          <ToolbarField label="To">
            <input className="toolbar__search toolbar__date" type="date" aria-label="To date" title="Only entries on or before this date" value={filters.to} onChange={set('to')} />
          </ToolbarField>
        </div>
        <ReportMeta>
          Status: {filters.status ? labelFor(JOURNAL_STATUSES, filters.status) : 'All'} · {range} · {rows.length} entries
        </ReportMeta>
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={journalColumns}
            rows={rows}
            caption="Journal entries report"
            empty="No journal entries match these filters."
            footer={rows.length ? { created_by_name: 'Totals', total_debits: num(total(rows, 'total_debits')), total_credits: num(total(rows, 'total_credits')) } : undefined}
          />
        </AsyncContent>
      </Panel>
    </>
  )
}

const eventColumns = [
  { key: 'id', header: 'Event ID', width: '9%' },
  { key: 'changed_at', header: 'Date / time', width: '18%', render: (e) => formatDateTime(e.changed_at) },
  { key: 'username', header: 'User', width: '17%', render: (e) => `${e.username ?? '—'} (ID ${e.user_id})` },
  { key: 'action', header: 'Action', width: '11%', render: (e) => ACTIONS[e.action] ?? e.action },
  {
    key: 'record',
    header: 'Record',
    width: '17%',
    sortValue: (e) => `${e.table_name} ${String(e.record_id).padStart(10, '0')}`,
    render: (e) =>
      e.table_name === 'accounts' ? (
        <Link to={`/accounts/${e.record_id}/ledger`} title="Open this account's ledger">Account #{e.record_id}</Link>
      ) : (
        <Link to={`/journal/${e.record_id}`} title="Open this journal entry">Journal entry #{e.record_id}</Link>
      ),
  },
  {
    key: 'changed',
    header: 'Fields changed',
    sortValue: (e) => changedFields(e).join(', '),
    render: (e) => changedFields(e).join(', ') || (e.action === 'ADD' ? 'New record' : '—'),
  },
]

export function EventLogReport() {
  const { data, error, loading } = useApi(() => api.eventLogs())
  const rows = data ?? []
  return (
    <>
      <PageHeader title="Event Log Report" subtitle="Every addition, change and deactivation, newest first." />
      <Panel title="Event log" className="page-panel" action={<ReportActions />}>
        <ReportMeta>{rows.length} events</ReportMeta>
        <AsyncContent loading={loading} error={error}>
          <DataTable columns={eventColumns} rows={rows} caption="Event log report" empty="No changes recorded yet." />
        </AsyncContent>
      </Panel>
    </>
  )
}
