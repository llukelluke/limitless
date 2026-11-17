import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChartColumn, FileText, History, Mail, NotebookPen } from 'lucide-react'
import { api } from '../api/client.js'
import Alert from '../components/Alert.jsx'
import { PageHeader, Panel } from '../components/AdminUI.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { ROLES, labelFor } from '../constants.js'
import useApi from '../hooks/useApi.js'

// Common tasks in plain words, so a new user knows where to start.
const TASKS = [
  { icon: NotebookPen, title: 'Record a journal entry', text: 'Write down a business transaction: which accounts are debited and credited.', to: '/journal/new' },
  { icon: BookOpen, title: 'Look up an account', text: 'See every account, its balance, and the ledger of everything posted to it.', to: '/accounts' },
  { icon: FileText, title: 'Review the journal', text: 'See all entries and whether they are pending, approved or rejected.', to: '/journal' },
  { icon: ChartColumn, title: 'Financial statements', text: 'Trial balance, income statement, balance sheet and retained earnings.', to: '/reports/statements', managerOnly: true },
  { icon: ChartColumn, title: 'Reports', text: 'View and print the chart of accounts, journal and event log reports.', to: '/reports' },
  { icon: History, title: 'See recent changes', text: 'The event log shows who changed what, with before and after values.', to: '/event-log' },
  { icon: Mail, title: 'Ask a question', text: 'Email a manager, accountant or administrator from inside Limitless.', to: '/email' },
]

// Landing page for managers and accountants. Managers are told about entries waiting for approval.
export default function Home() {
  const { user } = useAuth()
  const { data } = useApi(api.pendingJournalCount)
  const pending = data?.count ?? 0
  const { data: adjustingData } = useApi(() => api.pendingJournalCount('ADJUSTING'))
  const adjusting = adjustingData?.count ?? 0
  const role = labelFor(ROLES, user.role).toLowerCase()
  const article = /^[aeiou]/.test(role) ? 'an' : 'a'
  const tasks = TASKS.filter((task) => !task.managerOnly || user.role === 'MANAGER')

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.username}`}
        subtitle={`You are signed in as ${article} ${role}. Pick a task below to get started.`}
      />
      {user.role === 'MANAGER' && pending > 0 && (
        <div className="home-alert">
          <Alert tone="info">
            <strong>
              {pending} journal {pending === 1 ? 'entry is' : 'entries are'} waiting for your approval.
            </strong>{' '}
            {adjusting > 0 && `${adjusting} of them ${adjusting === 1 ? 'is an adjusting entry' : 'are adjusting entries'}. `}
            <Link to="/journal?status=SUBMITTED">Review pending entries →</Link>
            {adjusting > 0 && (
              <>
                {' '}
                <Link to="/journal?status=SUBMITTED&type=ADJUSTING">Review pending adjusting entries →</Link>
              </>
            )}
          </Alert>
        </div>
      )}
      <Panel title="What would you like to do?" className="page-panel">
        <div className="task-cards">
          {tasks.map(({ icon: Icon, title, text, to }) => (
            <Link key={title} to={to} className="task-card" title={text}>
              <span className="task-card__icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="task-card__body">
                <span className="task-card__title">{title}</span>
                <span className="task-card__text">{text}</span>
              </span>
              <ArrowRight className="task-card__arrow" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <p className="home-note">
          New to accounting? Open <strong>Help</strong> at the top of any page for a short guide to every feature.
          Contact your administrator if you need your role or account details changed.
        </p>
      </Panel>
    </>
  )
}
