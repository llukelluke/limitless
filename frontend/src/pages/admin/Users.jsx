import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, Select, ToolbarField } from '../../components/AdminUI.jsx'
import { ROLES, STATUSES, fullName, isSystemUser } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { userColumns } from './columns.jsx'

const columns = [
  ...userColumns,
  { key: 'action', header: 'ACTION', render: (user) => <Link to={`/admin/users/${user.id}`}>Edit →</Link> },
]

const matchesSearch = (user, term) =>
  [fullName(user), user.username, user.email_address].some((text) => text?.toLowerCase().includes(term))

// 11 User Management
export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const role = searchParams.get('role') ?? ''
  const status = searchParams.get('status') ?? ''
  const { data, error, loading } = useApi(api.listUsers)

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const term = search.trim().toLowerCase()
  const rows = (data ?? [])
    .filter(isSystemUser)
    .filter((user) => !role || user.role === role)
    .filter((user) => !status || user.status === status)
    .filter((user) => !term || matchesSearch(user, term))

  return (
    <>
      <PageHeader title="User Management" subtitle="Manage user accounts, roles, and access." />

      <Panel
        title="USERS"
        className="page-panel"
        action={
          <Link to="/admin/users/new" className="btn btn--primary btn--sm" title="Create a new user account">
            Add User
          </Link>
        }
      >
        <div className="toolbar" role="search">
          <ToolbarField label="SEARCH">
            <input
              className="toolbar__search"
              type="search"
              placeholder="Name, username or email"
              aria-label="Search users"
              title="Search by name, username or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </ToolbarField>
          <ToolbarField label="ROLE">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by role"
              title="Filter by role"
              options={[{ value: '', label: 'All' }, ...ROLES]}
              value={role}
              onChange={(event) => setFilter('role', event.target.value)}
            />
          </ToolbarField>
          <ToolbarField label="STATUS">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Filter by status"
              title="Filter by status"
              options={[{ value: '', label: 'All' }, ...STATUSES.filter((option) => option.value !== 'PENDING')]}
              value={status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
          </ToolbarField>
        </div>

        <AsyncContent loading={loading} error={error}>
          <DataTable columns={columns} rows={rows} caption="Users" empty="No users match these filters." />
        </AsyncContent>
      </Panel>
    </>
  )
}
