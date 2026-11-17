import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, ChartColumn, History, House, LayoutDashboard, Mail, NotebookPen, Sparkles, Users } from 'lucide-react'
import Calendar from '../components/Calendar.jsx'
import CalculatorButton from '../components/CalculatorButton.jsx'
import HelpButton from '../components/HelpButton.jsx'
import Logo from '../components/Logo.jsx'
import UserMenu from '../components/UserMenu.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { homePathFor, isAdmin } from '../constants.js'
import { CURRENT_VERSION } from '../releases.js'
import './AppLayout.css'

const ACCOUNTING_NAV = [
  { label: 'Accounts', icon: BookOpen, to: '/accounts', match: ['/accounts'], title: 'View the chart of accounts' },
  { label: 'Journal', icon: NotebookPen, to: '/journal', match: ['/journal'], title: 'Create and review journal entries' },
  { label: 'Event Log', icon: History, to: '/event-log', match: ['/event-log'], title: 'View the history of changes to records' },
]

// `match` lists the path prefixes that highlight each item (access requests live under Dashboard).
const ADMIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', match: ['/admin/access-requests'], exact: '/admin', title: 'Administrator dashboard' },
  { label: 'Users', icon: Users, to: '/admin/users', match: ['/admin/users'], title: 'Manage user accounts' },
  ...ACCOUNTING_NAV,
  { label: 'Reports', icon: ChartColumn, to: '/admin/reports', match: ['/admin/reports', '/reports'], title: 'View and print financial and user reports' },
  { label: 'Email', icon: Mail, to: '/admin/email', match: ['/admin/email'], title: 'Send an email to a user' },
]

const MEMBER_NAV = [
  { label: 'Home', icon: House, to: '/home', match: [], exact: '/home', title: 'Your home page' },
  ...ACCOUNTING_NAV,
  { label: 'Reports', icon: ChartColumn, to: '/reports', match: ['/reports'], title: 'View and print financial reports' },
  { label: 'Email', icon: Mail, to: '/email', match: ['/email'], title: 'Email another Limitless user' },
]

// Quick links across the top of every page (Sprint 2 requirement), plus the calculator and help.
const SERVICES = [
  { label: 'Chart of Accounts', icon: BookOpen, to: '/accounts', title: 'View, search and filter the chart of accounts' },
  { label: 'Journalize', icon: NotebookPen, to: '/journal', title: 'Journalizing: create and review journal entries' },
  { label: 'Event Log', icon: History, to: '/event-log', title: 'View the before and after images of every change' },
]

function isActive(item, pathname) {
  const path = pathname.replace(/\/$/, '')
  return path === item.exact || item.match.some((prefix) => path.startsWith(prefix))
}

// Navy sidebar (signed-in user and calendar top left, logo, icon menu) and a light content area with a top bar.
export default function AppLayout() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navItems = isAdmin(user) ? ADMIN_NAV : MEMBER_NAV
  const activeIndex = navItems.findIndex((item) => isActive(item, pathname))

  // The highlight slides to the active menu item
  const navRef = useRef(null)
  const [indicator, setIndicator] = useState(null)
  useLayoutEffect(() => {
    const place = () => {
      const link = navRef.current?.querySelectorAll('.app__nav-link')[activeIndex]
      setIndicator(link ? { top: link.offsetTop, left: link.offsetLeft, width: link.offsetWidth, height: link.offsetHeight } : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [activeIndex])

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
        <nav className="app__nav" aria-label="Main" ref={navRef}>
          {indicator && (
            <span
              className="app__nav-indicator"
              style={{ transform: `translate(${indicator.left}px, ${indicator.top}px)`, width: indicator.width, height: indicator.height }}
              aria-hidden="true"
            />
          )}
          {navItems.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.title}
                className={`app__nav-link ${active ? 'app__nav-link--active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="app__nav-icon" size={20} strokeWidth={1.9} aria-hidden="true" />
                <span className="app__nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <Link to="/whats-new" className="app__version" title="See what changed in each version of Limitless">
          <Sparkles size={15} aria-hidden="true" />
          <span>Version {CURRENT_VERSION} · What&apos;s New</span>
        </Link>
      </aside>
      <div className="app__main">
        <header className="app__topbar">
          <div className="app__services" role="toolbar" aria-label="Services">
            {SERVICES.map(({ label, icon: Icon, to, title }) => (
              <Link key={label} to={to} className="app__service" title={title}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
            <CalculatorButton />
            <HelpButton className="app__service" />
          </div>
          <UserMenu user={user} onSignOut={logout} />
        </header>
        {/* Keyed by path so each new page fades in */}
        <main className="app__content" key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
