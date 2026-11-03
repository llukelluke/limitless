import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Alert from '../components/Alert.jsx'
import { PageHeader, Panel } from '../components/AdminUI.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { ROLES, labelFor } from '../constants.js'
import useApi from '../hooks/useApi.js'

// Landing page for managers and accountants. Managers are told about entries waiting for approval.
export default function Home() {
  const { user } = useAuth()
  const { data } = useApi(api.pendingJournalCount)
  const pending = data?.count ?? 0
  const role = labelFor(ROLES, user.role).toLowerCase()
  const article = /^[aeiou]/.test(role) ? 'an' : 'a'

  return (
    <>
      <PageHeader
        eyebrow={labelFor(ROLES, user.role).toUpperCase()}
        title={`Welcome, ${user.username}`}
        subtitle="Your financial workspace."
      />
      <Panel title="GETTING STARTED" className="page-panel">
        {user.role === 'MANAGER' && pending > 0 && (
          <Alert tone="info">
            <strong>
              {pending} journal {pending === 1 ? 'entry is' : 'entries are'} waiting for your approval.
            </strong>{' '}
            <Link to="/journal?status=SUBMITTED">Review pending entries →</Link>
          </Alert>
        )}
        <p className="home-note">
          You are signed in as {article} {role}. Open the <Link to="/accounts">Chart of Accounts</Link> to
          view accounts and their ledgers, the <Link to="/journal">Journal</Link> to prepare and review journal
          entries, or the <Link to="/event-log">Event Log</Link> to see recent changes.
          Contact your administrator if you need your role or account details changed.
        </p>
      </Panel>
    </>
  )
}
