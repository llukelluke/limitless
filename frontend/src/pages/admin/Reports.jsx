import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, ReportActions, ReportMeta, UserStatus } from '../../components/AdminUI.jsx'
import { ROLES, STATUSES, formatDate, isSystemUser, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { passwordStatusColumn, userColumns } from './columns.jsx'

// 16 All Users Report
export function AllUsersReport() {
  const { data, error, loading } = useApi(api.allUsersReport)

  return (
    <>
      <PageHeader title="All Users Report" subtitle="View registered users and account information." />

      <Panel
        title="All Users Report"
        className="page-panel"
        action={<ReportActions back="/admin/reports" />}
      >
        <ReportMeta />
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={[...userColumns, passwordStatusColumn]}
            rows={(data ?? []).filter(isSystemUser)}
            caption="All users"
            empty="No users yet."
          />
        </AsyncContent>
      </Panel>
    </>
  )
}

const expiredColumns = [
  ...userColumns.slice(0, 3),
  { key: 'password_expiry', header: 'PASSWORD EXPIRED', width: '20%', render: (user) => formatDate(user.password_expiry) },
  { key: 'status', header: 'ACCOUNT STATUS', render: (user) => <UserStatus user={user} />, sortValue: (user) => labelFor(STATUSES, user.status) },
]

// 17 Expired Passwords Report
export function ExpiredPasswordsReport() {
  const { data, error, loading } = useApi(api.expiredPasswordsReport)

  return (
    <>
      <PageHeader title="Expired Passwords Report" subtitle="View users with expired passwords requiring attention." />

      <Panel
        title="Expired Passwords Report"
        className="page-panel"
        action={<ReportActions back="/admin/reports" />}
      >
        <ReportMeta />
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={expiredColumns}
            rows={data ?? []}
            caption="Users with expired passwords"
            empty="No expired passwords."
          />
        </AsyncContent>
      </Panel>
    </>
  )
}

const ACCOUNT_STATUSES = STATUSES.filter((status) => status.value !== 'PENDING')

// Users by Status & Role — a role × status count, then the suspended and deactivated users.
export function UsersByStatusReport() {
  const { data, error, loading } = useApi(api.allUsersReport)
  const users = (data ?? []).filter(isSystemUser)
  const count = (role, status) => users.filter((u) => (!role || u.role === role) && (!status || u.status === status)).length
  const countColumns = [
    { key: 'label', header: 'ROLE', width: '28%' },
    ...ACCOUNT_STATUSES.map((s) => ({ key: s.value, header: <span className="num">{s.label.toUpperCase()}</span>, width: '18%', render: (r) => <span className="num">{r[s.value]}</span> })),
    { key: 'total', header: <span className="num">TOTAL</span>, render: (r) => <span className="num">{r.total}</span> },
  ]
  const countRows = ROLES.map((role) => ({
    id: role.value,
    label: role.label,
    ...Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s.value, count(role.value, s.value)])),
    total: count(role.value),
  }))
  const totals = {
    label: 'All users',
    ...Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s.value, <span key={s.value} className="num">{count(null, s.value)}</span>])),
    total: <span className="num">{users.length}</span>,
  }
  const listColumns = [
    ...userColumns,
    { key: 'suspension_end', header: 'SUSPENDED UNTIL', render: (u) => (u.status === 'SUSPENDED' ? formatDate(u.suspension_end) : '—') },
  ]
  return (
    <>
      <PageHeader title="Users by Status & Role" subtitle="How many users hold each role, and who cannot sign in." />
      <Panel title="USERS BY STATUS & ROLE" className="page-panel" action={<ReportActions back="/admin/reports" />}>
        <ReportMeta>{users.length} users</ReportMeta>
        <AsyncContent loading={loading} error={error}>
          <DataTable columns={countColumns} rows={countRows} caption="User counts by role and status" footer={totals} />
          <h3 className="report-subhead">Suspended and deactivated users</h3>
          <DataTable
            columns={listColumns}
            rows={users.filter((u) => u.status === 'SUSPENDED' || u.status === 'DEACTIVATED')}
            caption="Suspended and deactivated users"
            empty="Every user is active."
          />
        </AsyncContent>
      </Panel>
    </>
  )
}
