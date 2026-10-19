import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { DataTable, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { formatDateTime, formatMoney } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import './Accounts.css'

const ACTIONS = { ADD: 'Added', MODIFY: 'Modified', DEACTIVATE: 'Deactivated' }

function parseImage(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

const MONEY_FIELDS = ['initial_balance', 'debit', 'credit', 'balance']

const show = (value, field) => {
  if (value === null || value === undefined || value === '') return '—'
  return MONEY_FIELDS.includes(field) ? formatMoney(value) : String(value)
}

// Before and after images side by side; changed fields are highlighted.
function Images({ event }) {
  const before = parseImage(event.before_image)
  const after = parseImage(event.after_image)
  const fields = Object.keys(after ?? before ?? {})
  const changed = fields.filter((field) => before && after && show(before[field], field) !== show(after[field], field))

  return (
    <details className="event-images">
      <summary title="Show the record before and after this change">
        {changed.length ? `Changed: ${changed.join(', ')}` : 'View images'}
      </summary>
      <table className="event-images__table">
        <thead>
          <tr>
            <th scope="col">FIELD</th>
            <th scope="col">BEFORE</th>
            <th scope="col">AFTER</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field} className={changed.includes(field) ? 'event-images__changed' : undefined}>
              <th scope="row">{field}</th>
              <td>{before ? show(before[field], field) : '—'}</td>
              <td>{after ? show(after[field], field) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

const columns = [
  { key: 'id', header: 'EVENT ID', width: '8%' },
  { key: 'changed_at', header: 'DATE / TIME', width: '17%', render: (e) => formatDateTime(e.changed_at) },
  { key: 'username', header: 'USER', width: '13%', render: (e) => `${e.username ?? '—'} (ID ${e.user_id})` },
  { key: 'action', header: 'ACTION', width: '10%', render: (e) => ACTIONS[e.action] ?? e.action },
  {
    key: 'record',
    header: 'RECORD',
    width: '14%',
    render: (e) =>
      e.table_name === 'accounts' ? (
        <Link to={`/accounts/${e.record_id}`} title="View this account">
          Account #{e.record_id}
        </Link>
      ) : (
        `${e.table_name} #${e.record_id}`
      ),
  },
  { key: 'images', header: 'BEFORE / AFTER', render: (e) => <Images event={e} /> },
]

// Events for one record (account details page) or for everything (Event Log page).
export function EventLogTable({ table, recordId }) {
  const { data, error, loading } = useApi(() => api.eventLogs(table, recordId), [table, recordId])
  return (
    <AsyncContent loading={loading} error={error}>
      <DataTable columns={columns} rows={data ?? []} caption="Event log" empty="No changes recorded yet." />
    </AsyncContent>
  )
}

// Event Log — before and after image of every record added, modified, or deactivated.
export default function EventLog() {
  return (
    <>
      <PageHeader
        eyebrow="EVENT LOG"
        title="Event Log"
        subtitle="Every addition, change, and deactivation, with who made it and when."
      />
      <Panel title="EVENTS" className="page-panel">
        <EventLogTable />
      </Panel>
    </>
  )
}
