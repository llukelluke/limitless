import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../components/AdminUI.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { ROLES, labelFor } from '../constants.js'

// Landing page for managers and accountants. Their Sprint 2+ tools will live here.
export default function Home() {
  const { user } = useAuth()
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
        <p className="home-note">
          You are signed in as {article} {role}. Open the <Link to="/accounts">Chart of Accounts</Link> to
          view accounts and their ledgers, or the <Link to="/event-log">Event Log</Link> to see recent changes.
          Contact your administrator if you need your role or account details changed.
        </p>
      </Panel>
    </>
  )
}
