// Release notes for the What's New page, newest first. Add an entry at the top for each release.
export const RELEASES = [
  {
    version: '5.0',
    date: '2026-11-18',
    title: 'Sprint 5: Closing and reversing entries',
    changes: [
      'Journal entries can be Closing or Reversing as well as Regular or Adjusting; the journal, reports and entry pages show and filter by all four.',
      'Financial statements leave out closing entries, so net income for a period isn\'t wiped out by the entry that closes it.',
      'An account picked as a debit can\'t also be picked as a credit on the same entry, and vice versa.',
      'Click an attachment to view it in the browser instead of downloading it.',
      'Report totals are double ruled, and the income statement shows Net Income (Loss).',
    ],
  },
  {
    version: '4.0',
    date: '2026-11-16',
    title: 'Sprint 4: Adjusting entries and financial statements',
    changes: [
      'Managers generate the trial balance, income statement, balance sheet and retained earnings statement for a date or a date range, from Reports → Financial Statements. Each can be saved, emailed or printed, and saved statements can be reopened.',
      'Click an account number or name on a statement to open its ledger.',
      'The journal can be filtered by type, so adjusting entries can be listed by pending, approved or rejected status.',
      'The manager\'s home page says how many pending entries are adjusting entries, with a link to them.',
      'Every report links each account to its ledger, including saved and printed statements.',
      'Fields with an error are outlined in red, and the cursor moves to the first one.',
      'Email: every role can email any active user, and files can be attached.',
    ],
  },
  {
    version: '3.1',
    date: '2026-11-03',
    title: 'Sprint 1 and 2 feedback',
    changes: [
      'Calculator on every page, from the Calculator button in the top toolbar.',
      'Sort any table by clicking a column heading; click again to reverse the order.',
      'New printable reports: Chart of Accounts, Journal Entries, Event Log, and Users by Status & Role. Every report, including the existing ones, has a Print button.',
      'Temporary passwords now expire after 24 hours. Administrators can issue a new one from the user\'s page.',
      'Sign-in refuses an empty username or password, shows the error next to the field, and no longer counts it as a failed attempt.',
      'This What\'s New page.',
    ],
  },
  {
    version: '3.0',
    date: '2026-11-03',
    title: 'Sprint 3: Journalizing and ledgers',
    changes: [
      'Managers and accountants prepare journal entries with any number of debits and credits, and attach source documents (PDF, Word, Excel, CSV, JPG, PNG).',
      'Entries are checked as you type: debits must equal credits, accounts must be active, and amounts can have at most two decimals. Error text comes from the database.',
      'Managers see entries waiting for approval, and approve them or reject them with a reason. Approved entries post to the ledger.',
      'Each account has a ledger with date, description, post reference, debit, credit and a running balance.',
      'Search and filter journal entries by status, date range, account name or amount.',
      'Managers and accountants can email managers and administrators from the account pages.',
    ],
  },
  {
    version: '2.0',
    date: '2026-10-20',
    title: 'Sprint 2: Chart of accounts',
    changes: [
      'Administrators add, edit and deactivate accounts; managers and accountants view them.',
      'Search the chart of accounts by name or number and filter by category, subcategory, statement, status and balance.',
      'The event log records every change with before and after images, highlighting the fields that changed.',
      'Help organized by topic, a pop-up calendar, and a tooltip on every button.',
      'A Clear button on the sign-in page.',
    ],
  },
  {
    version: '1.0',
    date: '2026-10-06',
    title: 'Sprint 1: Users and sign-in',
    changes: [
      'Sign in, request access, and reset a forgotten password with security questions.',
      'Three failed sign-ins suspend an account; passwords expire after 90 days.',
      'Administrators create users, approve access requests, set roles, and activate, deactivate or suspend users.',
      'User reports (all users, expired passwords) and email to users.',
    ],
  },
]

export const CURRENT_VERSION = RELEASES[0].version
