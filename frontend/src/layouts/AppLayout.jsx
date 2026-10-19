import { Link, Outlet, useLocation } from 'react-router-dom'
import Calendar from '../components/Calendar.jsx'
import HelpButton from '../components/HelpButton.jsx'
import Logo from '../components/Logo.jsx'
import UserMenu from '../components/UserMenu.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { homePathFor, isAdmin } from '../constants.js'
import './AppLayout.css'

const ACCOUNTING_NAV = [
  { label: 'Accounts', to: '/accounts', match: ['/accounts'], title: 'View the chart of accounts' },
  { label: 'Event Log', to: '/event-log', match: ['/event-log'], title: 'View the history of changes to records' },
]

// `match` lists the path prefixes that highlight each item (access requests live under Dashboard).
const ADMIN_NAV = [
  { label: 'Dashboard', to: '/admin', match: ['/admin/access-requests'], exact: '/admin', title: 'Administrator dashboard' },
  { label: 'Users', to: '/admin/users', match: ['/admin/users'], title: 'Manage user accounts' },
  ...ACCOUNTING_NAV,
  { label: 'Reports', to: '/admin/reports', match: ['/admin/reports'], title: 'View user reports' },
  { label: 'Email', to: '/admin/email', match: ['/admin/email'], title: 'Send an email to a user' },
]

const MEMBER_NAV = [{ label: 'Home', to: '/home', match: [], exact: '/home', title: 'Your home page' }, ...ACCOUNTING_NAV]

function isActive(item, pathname) {
  const path = pathname.replace(/\/$/, '')
  return path === item.exact || item.match.some((prefix) => path.startsWith(prefix))
}

// Screens 10–19: sidebar navigation, signed-in user and calendar in the top left, services across the top.
export default function AppLayout() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navItems = isAdmin(user) ? ADMIN_NAV : MEMBER_NAV

  return (
    <div className="app">
      <aside className="app__sidebar">
        <div className="app__session">
          <p className="app__signed-in">
            Signed in as <strong>{user.username}</strong>
          </p>
          <Calendar />
        </div>
        <Link to={homePathFor(user)} className="app__logo" aria-label="Limitless home" title="Go to your home page">
          <Logo />
        </Link>
        <nav className="app__nav" aria-label="Main">
          {navItems.map((item) => {
            const active = isActive(item, pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.title}
                className={`app__nav-link ${active ? 'app__nav-link--active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="app__main">
        <div className="app__services" role="toolbar" aria-label="Services">
          <Link to="/accounts" className="app__service" title="View, search and filter the chart of accounts">
            Chart of Accounts
          </Link>
          {/* shortcut: journalizing is Sprint 3, link it to its page once that exists */}
          <button type="button" className="app__service" disabled title="Journalizing: create and review journal entries (coming in the next release)">
            Journalize
          </button>
          <Link to="/event-log" className="app__service" title="View the before and after images of every change">
            Event Log
          </Link>
          <HelpButton />
        </div>
        <UserMenu user={user} onSignOut={logout} />
        <Outlet />
      </div>
    </div>
  )
}
