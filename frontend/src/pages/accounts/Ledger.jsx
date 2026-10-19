import { useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, DataTable, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { NORMAL_SIDES, formatDateTime, formatMoney, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import './Accounts.css'

const money = (key) => ({
  key,
  header: <span className="num">{key.toUpperCase()}</span>,
  width: '15%',
  render: (row) => <span className="num">{row[key] === null ? '' : formatMoney(row[key])}</span>,
})

const columns = [
  { key: 'date', header: 'DATE', width: '22%', render: (row) => formatDateTime(row.date) },
  { key: 'description', header: 'DESCRIPTION', width: '25%' },
  { key: 'pr', header: 'PR', width: '8%' },
  money('debit'),
  money('credit'),
  money('balance'),
]

// Account ledger. shortcut: shows only the opening balance until journal entries (Sprint 3) post here.
export default function Ledger() {
  const { id } = useParams()
  const { data: account, error, loading } = useApi(() => api.getAccount(id), [id])

  const opening = account && {
    id: 'opening',
    date: account.added_at,
    description: 'Opening balance',
    pr: '',
    debit: account.normal_side === 'LEFT' ? account.initial_balance : null,
    credit: account.normal_side === 'RIGHT' ? account.initial_balance : null,
    balance: account.initial_balance,
  }

  return (
    <>
      <PageHeader
        eyebrow="LEDGER"
        title={account ? `${account.number} · ${account.name}` : 'Ledger'}
        subtitle="Every posting to this account, with a running balance."
      />

      <Panel
        title="LEDGER"
        className="page-panel"
        action={<BackLink to="/accounts">Back to Chart of Accounts</BackLink>}
      >
        <AsyncContent loading={loading && !account} error={error}>
          {account && (
            <>
              <dl className="ledger-summary">
                <div>
                  <dt>NORMAL SIDE</dt>
                  <dd>{labelFor(NORMAL_SIDES, account.normal_side)}</dd>
                </div>
                <div>
                  <dt>TOTAL DEBITS</dt>
                  <dd>{formatMoney(account.debit)}</dd>
                </div>
                <div>
                  <dt>TOTAL CREDITS</dt>
                  <dd>{formatMoney(account.credit)}</dd>
                </div>
                <div>
                  <dt>BALANCE</dt>
                  <dd>{formatMoney(account.balance)}</dd>
                </div>
              </dl>
              <DataTable columns={columns} rows={[opening]} caption={`Ledger for ${account.name}`} />
              <p className="async-status">Journal entries will be listed here once journalizing is available.</p>
            </>
          )}
        </AsyncContent>
      </Panel>
    </>
  )
}
