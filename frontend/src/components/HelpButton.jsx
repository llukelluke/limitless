import { useRef, useState } from 'react'
import './HelpButton.css'

// Help for the whole application, organized by topic. Shown from every page.
const TOPICS = [
  {
    title: 'Getting Started',
    body: [
      'Limitless is an accounting application for administrators, managers and accountants.',
      'Use the menu on the left or the service buttons at the top of each page to move between features. Your username and today\'s date are shown in the top left corner; click the date to open a calendar.',
      'Hover over any button to see a short description of what it does.',
      'Click any column heading in a table to sort by it; click again to reverse the order.',
      'The Calculator button in the top toolbar opens a calculator you can drag anywhere on the page.',
      'Click "What\'s New" at the bottom of the left menu to see what changed in each version.',
    ],
  },
  {
    title: 'Signing In & Passwords',
    body: [
      'Sign in with the username and password your administrator gave you. New users can request access from the sign-in page; an administrator must approve the request.',
      'Temporary passwords expire 24 hours after they are issued. If yours has expired, ask an administrator for a new one.',
      'Passwords must be at least 8 characters, start with a letter, and include a letter, a number and a special character. Passwords expire after 90 days.',
      'After three failed sign-in attempts your account is suspended. Use "Forgot password" to reset it by answering your security questions.',
    ],
  },
  {
    title: 'Chart of Accounts',
    body: [
      'The Chart of Accounts lists every account with its number, name, category, subcategory, normal side, balance and statement.',
      'Search by account name or number, or filter by category, subcategory, statement, status and balance range.',
      'Click an account name to open its ledger. Click "View" to see all of the account\'s details and its change history.',
    ],
  },
  {
    title: 'Adding & Editing Accounts',
    body: [
      'Only administrators can add, edit or deactivate accounts. Managers and accountants can view them.',
      'Account numbers are digits only and start with the category digit: 1 Asset, 2 Liability, 3 Equity, 4 Revenue, 5 Expense. Account names and numbers must be unique.',
      'Monetary values use two decimal places and may include commas, for example 1,250.00.',
      'An account can only be deactivated when its balance is zero or less.',
    ],
  },
  {
    title: 'Ledgers',
    body: [
      'Each account has a ledger showing its opening balance and every approved journal entry that changed it, with a running balance.',
      'Click the post reference (PR) to open the journal entry. Filter by date, or search by amount, description or post reference.',
    ],
  },
  {
    title: 'Journalizing',
    body: [
      'Managers and accountants prepare journal entries: debits first, then credits. Debits must equal credits, and only active accounts can be used.',
      'Attach source documents (PDF, Word, Excel, CSV, JPG or PNG). Errors are shown in red and clear as soon as they are fixed.',
      'Submitted entries wait for a manager, who approves them (posting them to the ledger) or rejects them with a reason.',
      'Search the journal by account name, amount or date, and filter by status or date range.',
    ],
  },
  {
    title: 'Reports',
    body: [
      'Open Reports from the left menu. Financial reports: Chart of Accounts, Journal Entries and Event Log. Administrators also see user reports.',
      'Every report has a Print button; the printout leaves out the menus and buttons.',
    ],
  },
  {
    title: 'Event Log',
    body: [
      'Every time an account is added, modified or deactivated, the event log records who made the change, when, and the record before and after the change.',
      'Each event has its own ID. Open an event to compare the before and after images.',
    ],
  },
  {
    title: 'User Administration',
    body: [
      'Administrators create users, assign roles, approve access requests, activate, deactivate or suspend users, view user reports and email users.',
    ],
  },
]

export default function HelpButton({ className = '' }) {
  const dialogRef = useRef(null)
  const [topic, setTopic] = useState(0)

  return (
    <>
      <button
        type="button"
        className={`help-button ${className}`}
        title="Help: how to use Limitless, organized by topic"
        onClick={() => dialogRef.current?.showModal()}
      >
        ? Help
      </button>
      <dialog
        ref={dialogRef}
        className="help-dialog"
        aria-label="Help"
        // Clicking the backdrop (the dialog element itself) closes it
        onClick={(event) => event.target === dialogRef.current && dialogRef.current.close()}
      >
        <div className="help-dialog__head">
          <h2 className="panel__title">HELP</h2>
          <button
            type="button"
            className="text-link text-link--strong"
            title="Close help"
            onClick={() => dialogRef.current?.close()}
          >
            Close ✕
          </button>
        </div>
        <div className="help-dialog__body">
          <nav className="help-dialog__topics" aria-label="Help topics">
            {TOPICS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                title={`Show help for ${item.title}`}
                className={`help-dialog__topic ${index === topic ? 'help-dialog__topic--active' : ''}`}
                aria-current={index === topic ? 'true' : undefined}
                onClick={() => setTopic(index)}
              >
                {item.title}
              </button>
            ))}
          </nav>
          <article className="help-dialog__content">
            <h3 className="help-dialog__title">{TOPICS[topic].title}</h3>
            {TOPICS[topic].body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        </div>
      </dialog>
    </>
  )
}
