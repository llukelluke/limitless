import { Link } from 'react-router-dom'
import { UserStatus } from '../../components/AdminUI.jsx'
import { ROLES, STATUSES, formatDate, fullName, labelFor, passwordStatus } from '../../constants.js'

// Table column definitions shared across the admin screens. Rows are UserResponse objects from the API.

export const requestColumns = [
  { key: 'name', header: 'NAME', width: '24%', render: fullName, sortValue: fullName },
  { key: 'email_address', header: 'EMAIL', width: '33%' },
  { key: 'created_at', header: 'REQUESTED', width: '25%', render: (request) => formatDate(request.created_at) },
  {
    key: 'action',
    header: 'ACTION',
    render: (request) => <Link to={`/admin/access-requests/${request.id}`}>Review →</Link>,
  },
]

export const userColumns = [
  { key: 'name', header: 'NAME', width: '21%', render: fullName, sortValue: fullName },
  { key: 'username', header: 'USERNAME', width: '23.5%' },
  { key: 'role', header: 'ROLE', width: '16%', render: (user) => labelFor(ROLES, user.role) },
  { key: 'status', header: 'STATUS', width: '20%', render: (user) => <UserStatus user={user} />, sortValue: (user) => labelFor(STATUSES, user.status) },
]

export const passwordStatusColumn = { key: 'password_status', header: 'PASSWORD STATUS', render: passwordStatus, sortValue: passwordStatus }
