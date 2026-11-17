import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, StatCard } from '../../components/AdminUI.jsx'
import { isSystemUser } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { requestColumns } from './columns.jsx'

// 10 Administrator Dashboard
export default function Dashboard() {
  const { data: users, error, loading } = useApi(api.listUsers)
  const all = users ?? []
  const pending = all.filter((user) => user.status === 'PENDING')
  const count = (value) => (loading ? '–' : value)

  return (
    <>
      <PageHeader
        title="Administrator Dashboard"
        subtitle="Manage users, access requirements, and account activity."
      />

      <div className="stat-cards">
        <StatCard
          label="Total users"
          value={count(all.filter(isSystemUser).length)}
          linkTo="/admin/users"
          linkLabel="View Users"
        />
        <StatCard
          label="Pending requests"
          value={count(pending.length)}
          linkTo="/admin/access-requests"
          linkLabel="Review Requests"
        />
        <StatCard
          label="Suspended users"
          value={count(all.filter((user) => user.status === 'SUSPENDED').length)}
          linkTo="/admin/users?status=SUSPENDED"
          linkLabel="View Users"
        />
      </div>

      <Panel title="Pending access requests" className="dashboard-requests">
        <AsyncContent loading={loading} error={error}>
          <DataTable
            columns={requestColumns}
            rows={pending}
            caption="Pending access requests"
            empty="No pending access requests."
          />
        </AsyncContent>
      </Panel>
    </>
  )
}
