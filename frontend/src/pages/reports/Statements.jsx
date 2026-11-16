import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel, PrintButton, ReportMeta, Select, ToolbarField, BackLink } from '../../components/AdminUI.jsx'
import { ROLES, formatDate, formatDateTime, formatMoney, labelFor, todayIso } from '../../constants.js'
import useApi from '../../hooks/useApi.js'

const STATEMENT_TYPES = [
  { value: 'trial-balance', label: 'Trial Balance' },
  { value: 'income-statement', label: 'Income Statement' },
  { value: 'balance-sheet', label: 'Balance Sheet' },
  { value: 'retained-earnings', label: 'Retained Earnings Statement' },
]

const SAVED_NAMES = {
  TRIAL_BALANCE: 'Trial Balance',
  INCOME_STATEMENT: 'Income Statement',
  BALANCE_SHEET: 'Balance Sheet',
  RETAINED_EARNINGS: 'Retained Earnings Statement',
}

const PERIODS = [
  { value: 'date', label: 'As of a date' },
  { value: 'range', label: 'Date range' },
]

// Bottom line shown under the sections (trial balance totals go in its debit/credit columns instead).
const GRAND_TOTALS = {
  'income-statement': ['net_income', 'Net Income'],
  'balance-sheet': ['total_liabilities_and_equity', "Total Liabilities & Stockholders' Equity"],
}

const num = (value) => <span className="num">{value === null || value === undefined ? '' : formatMoney(value)}</span>

// Account number and name both open the account's ledger.
function AccountCells({ row }) {
  if (!row.account_id) return <td colSpan={2}>{row.name}</td>
  const to = `/accounts/${row.account_id}/ledger`
  const title = `Open the ledger for ${row.name}`
  return (
    <>
      <td>
        <Link to={to} title={title}>
          {row.account_number}
        </Link>
      </td>
      <td>
        <Link to={to} title={title}>
          {row.name}
        </Link>
      </td>
    </>
  )
}

function StatementTable({ statement }) {
  const trial = statement.type === 'trial-balance'
  const grand = GRAND_TOTALS[statement.type]
  const width = trial ? 4 : 3
  return (
    <div className="data-table__scroll">
      <table className="data-table statement-table">
        <caption className="visually-hidden">{statement.title}</caption>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col />
          {trial && <col style={{ width: '18%' }} />}
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">NUMBER</th>
            <th scope="col">ACCOUNT</th>
            {trial ? (
              <>
                <th scope="col"><span className="num">DEBIT</span></th>
                <th scope="col"><span className="num">CREDIT</span></th>
              </>
            ) : (
              <th scope="col"><span className="num">AMOUNT</span></th>
            )}
          </tr>
        </thead>
        <tbody>
          {statement.sections.map((section) => (
            <Fragment key={section.title}>
              {!trial && (
                <tr className="statement-table__section">
                  <th scope="rowgroup" colSpan={width}>{section.title}</th>
                </tr>
              )}
              {section.rows.length === 0 && (
                <tr>
                  <td colSpan={width} className="data-table__empty">No accounts with a balance.</td>
                </tr>
              )}
              {section.rows.map((row, index) => (
                <Fragment key={row.account_id ?? row.name}>
                  {/* Balance sheet rows are grouped by subcategory */}
                  {statement.type === 'balance-sheet' && row.subcategory && row.subcategory !== section.rows[index - 1]?.subcategory && (
                    <tr className="statement-table__group">
                      <td colSpan={width}>{row.subcategory}</td>
                    </tr>
                  )}
                  <tr>
                    <AccountCells row={row} />
                    {trial ? (
                      <>
                        <td>{num(row.debit)}</td>
                        <td>{num(row.credit)}</td>
                      </>
                    ) : (
                      <td>{num(row.amount)}</td>
                    )}
                  </tr>
                </Fragment>
              ))}
              {!trial && section.total !== null && section.total !== undefined && statement.type !== 'retained-earnings' && (
                <tr className="statement-table__total">
                  <td colSpan={2}>Total {section.title}</td>
                  <td>{num(section.total)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          {trial && (
            <tr>
              <td colSpan={2}>Totals</td>
              <td>{num(statement.totals.total_debits)}</td>
              <td>{num(statement.totals.total_credits)}</td>
            </tr>
          )}
          {grand && (
            <tr>
              <td colSpan={2}>{grand[1]}</td>
              <td>{num(statement.totals[grand[0]])}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}

function EmailStatement({ type, dates, title }) {
  const { data: recipients } = useApi(api.emailRecipients)
  const [form, setForm] = useState({ recipient: '', message: '' })
  const [feedback, setFeedback] = useState(null)
  const [sending, setSending] = useState(false)
  const options = [
    { value: '', label: recipients ? 'Select User...' : 'Loading users…' },
    ...(recipients ?? []).map((r) => ({ value: String(r.id), label: `${r.name} (${labelFor(ROLES, r.role)})` })),
  ]

  const send = async (event) => {
    event.preventDefault()
    if (!form.recipient) {
      setFeedback({ tone: 'error', message: 'Choose who to email the statement to.' })
      return
    }
    setSending(true)
    setFeedback(null)
    try {
      const result = await api.emailStatement(type, dates, {
        recipient_user_id: Number(form.recipient),
        subject: title,
        message: form.message.trim() || undefined,
      })
      setFeedback({ tone: 'success', message: result?.message ?? 'Email sent.' })
      setForm({ recipient: '', message: '' })
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="toolbar no-print" onSubmit={send} noValidate>
      <ToolbarField label="EMAIL TO">
        <Select
          wrapClassName="select--inline"
          className="toolbar__filter"
          aria-label="Email recipient"
          title="Who receives this statement"
          options={options}
          value={form.recipient}
          onChange={(event) => setForm((f) => ({ ...f, recipient: event.target.value }))}
        />
      </ToolbarField>
      <ToolbarField label="NOTE">
        <input
          className="toolbar__search"
          placeholder="Optional note"
          aria-label="Optional note shown above the statement"
          value={form.message}
          onChange={(event) => setForm((f) => ({ ...f, message: event.target.value }))}
        />
      </ToolbarField>
      <button type="submit" className="btn btn--secondary btn--sm" disabled={sending} title="Email this statement">
        {sending ? 'Sending…' : 'Email'}
      </button>
      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}
    </form>
  )
}

const savedColumns = (onOpen) => [
  { key: 'statement_type', header: 'STATEMENT', width: '26%', render: (s) => SAVED_NAMES[s.statement_type] ?? s.statement_type },
  {
    key: 'period',
    header: 'PERIOD',
    width: '26%',
    sortValue: (s) => s.period_end,
    render: (s) => (s.period_start ? `${formatDate(s.period_start)} to ${formatDate(s.period_end)}` : `As of ${formatDate(s.period_end)}`),
  },
  { key: 'generated_by_name', header: 'SAVED BY', width: '18%' },
  { key: 'generated_at', header: 'SAVED AT', width: '18%', render: (s) => formatDateTime(s.generated_at) },
  {
    key: 'view',
    header: 'ACTION',
    sortable: false,
    render: (s) => (
      <button type="button" className="text-link" title="Open the statement as it was saved" onClick={() => onOpen(s.id)}>
        View →
      </button>
    ),
  },
]

// Financial statements (manager only): trial balance, income statement, balance sheet and retained
// earnings statement for a date or a date range. Generate, view, save, email or print.
export default function Statements() {
  const [type, setType] = useState('trial-balance')
  const [period, setPeriod] = useState('date')
  const [range, setRange] = useState({ date: todayIso(), from: '', to: todayIso() })
  const dates = period === 'date' ? { date: range.date } : { from: range.from, to: range.to }
  const { data: statement, error, loading } = useApi(() => api.getStatement(type, dates), [type, dates])
  const saved = useApi(api.savedStatements)
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  const setDate = (key) => (event) => setRange((r) => ({ ...r, [key]: event.target.value }))
  const title = labelFor(STATEMENT_TYPES, type)

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      await api.saveStatement(type, dates)
      setFeedback({ tone: 'success', message: `${title} saved.` })
      saved.reload()
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const open = (id) => api.openSavedStatement(id).catch((err) => setFeedback({ tone: 'error', message: err.message }))

  const periodText = statement
    ? statement.from
      ? `${formatDate(statement.from)} to ${formatDate(statement.to)}`
      : `As of ${formatDate(statement.to)}`
    : ''

  return (
    <>
      <PageHeader eyebrow="REPORTS" title="Financial Statements" subtitle="Built from approved journal entries only." />
      <Panel
        title={title.toUpperCase()}
        className="page-panel"
        action={
          <span className="table-actions">
            <button type="button" className="btn btn--secondary btn--sm" disabled={!statement || saving} title="Save this statement as it is now" onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <PrintButton />
            <BackLink to="/reports">Back to Reports</BackLink>
          </span>
        }
      >
        <div className="toolbar" role="search">
          <ToolbarField label="STATEMENT">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Statement"
              title="Choose a financial statement"
              options={STATEMENT_TYPES}
              value={type}
              onChange={(event) => setType(event.target.value)}
            />
          </ToolbarField>
          <ToolbarField label="PERIOD">
            <Select
              wrapClassName="select--inline"
              className="toolbar__filter"
              aria-label="Period"
              title="A single date or a date range"
              options={PERIODS}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </ToolbarField>
          {period === 'date' ? (
            <ToolbarField label="DATE">
              <input className="toolbar__search toolbar__date" type="date" aria-label="As of date" title="Everything up to and including this date" value={range.date} onChange={setDate('date')} />
            </ToolbarField>
          ) : (
            <>
              <ToolbarField label="FROM">
                <input className="toolbar__search toolbar__date" type="date" aria-label="From date" title="Start of the period" value={range.from} onChange={setDate('from')} />
              </ToolbarField>
              <ToolbarField label="TO">
                <input className="toolbar__search toolbar__date" type="date" aria-label="To date" title="End of the period" value={range.to} onChange={setDate('to')} />
              </ToolbarField>
            </>
          )}
        </div>

        {statement && (
          <EmailStatement key={`${type} ${JSON.stringify(dates)}`} type={type} dates={dates} title={`${statement.title}, ${periodText}`} />
        )}
        {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

        <AsyncContent loading={loading} error={error}>
          {statement && (
            <>
              <h2 className="statement-title">
                Limitless · {statement.title}
                <span className="statement-title__period">{periodText}</span>
              </h2>
              <ReportMeta>Approved journal entries only</ReportMeta>
              {!statement.balanced && (
                <Alert>
                  {type === 'trial-balance'
                    ? 'This trial balance does not balance: total debits do not equal total credits.'
                    : 'This balance sheet does not balance: total assets do not equal total liabilities and stockholders’ equity.'}
                </Alert>
              )}
              <StatementTable statement={statement} />
            </>
          )}
        </AsyncContent>
      </Panel>

      <Panel title="SAVED STATEMENTS" className="page-panel no-print">
        <AsyncContent loading={saved.loading && !saved.data} error={saved.error}>
          <DataTable columns={savedColumns(open)} rows={saved.data ?? []} caption="Saved statements" empty="No statements saved yet." />
        </AsyncContent>
      </Panel>
    </>
  )
}
