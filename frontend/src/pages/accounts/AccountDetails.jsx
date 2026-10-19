import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, Field, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import {
  NORMAL_SIDES,
  STATEMENTS,
  formatDateTime,
  formatMoney,
  formatOrder,
  isAdmin,
  labelFor,
} from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { EventLogTable } from './EventLog.jsx'
import './Accounts.css'

const statementName = (value) => STATEMENTS.find((s) => s.value === value)?.name ?? '—'

// View one account's details. Administrators can also edit or deactivate it from here.
export default function AccountDetails() {
  const { id } = useParams()
  const { state } = useLocation()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const { data: account, error, loading, reload } = useApi(() => api.getAccount(id), [id])
  const [feedback, setFeedback] = useState(state?.saved ? { tone: 'success', message: state.saved } : null)
  const [busy, setBusy] = useState(false)
  const [logVersion, setLogVersion] = useState(0)

  const hasBalance = Number(account?.balance ?? 0) > 0

  const deactivate = async () => {
    if (!window.confirm(`Deactivate ${account.name}? It will no longer be available for new entries.`)) return
    setBusy(true)
    try {
      await api.deactivateAccount(account.id)
      setFeedback({ tone: 'success', message: 'Account deactivated.' })
      reload()
      setLogVersion((v) => v + 1)
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CHART OF ACCOUNTS"
        title={account ? `${account.number} · ${account.name}` : 'Account'}
        subtitle="Account details and change history."
      />

      <Panel
        title="ACCOUNT DETAILS"
        className="page-panel"
        action={<BackLink to="/accounts">Back to Chart of Accounts</BackLink>}
      >
        <AsyncContent loading={loading && !account} error={error}>
          {account && (
            <div className="form-body">
              <div className="account-actions">
                <Link
                  to={`/accounts/${account.id}/ledger`}
                  className="btn btn--secondary btn--sm"
                  title="Open this account's ledger"
                >
                  View Ledger
                </Link>
                {admin && (
                  <>
                    <Link
                      to={`/accounts/${account.id}/edit`}
                      className="btn btn--primary btn--sm"
                      title="Edit this account's information"
                    >
                      Edit Account
                    </Link>
                    {account.active && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={busy || hasBalance}
                        title={
                          hasBalance
                            ? 'Accounts with a balance greater than zero cannot be deactivated'
                            : 'Deactivate this account'
                        }
                        onClick={deactivate}
                      >
                        {busy ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {feedback && (
                <div className="form-feedback">
                  <Alert tone={feedback.tone}>{feedback.message}</Alert>
                </div>
              )}

              <FormSection title="ACCOUNT INFORMATION">
                <Field label="ACCOUNT NAME" value={account.name} readOnly />
                <Field label="ACCOUNT NUMBER" value={account.number} readOnly />
                <Field label="CATEGORY" value={account.category ?? '—'} readOnly />
                <Field label="SUBCATEGORY" value={account.subcategory ?? '—'} readOnly />
                <Field label="NORMAL SIDE" value={labelFor(NORMAL_SIDES, account.normal_side)} readOnly />
                <Field label="STATEMENT" value={statementName(account.statement)} readOnly />
                <Field label="ORDER" value={formatOrder(account.order)} readOnly />
                <Field label="STATUS" value={account.active ? 'Active' : 'Inactive'} readOnly />
                <Field label="DESCRIPTION" value={account.description ?? '—'} readOnly className="field--wide" />
              </FormSection>

              <FormSection title="BALANCES">
                <Field label="INITIAL BALANCE" value={formatMoney(account.initial_balance)} readOnly />
                <Field label="DEBIT" value={formatMoney(account.debit)} readOnly />
                <Field label="CREDIT" value={formatMoney(account.credit)} readOnly />
                <Field label="BALANCE" value={formatMoney(account.balance)} readOnly />
              </FormSection>

              <FormSection title="OTHER">
                <Field label="DATE ADDED" value={formatDateTime(account.added_at)} readOnly />
                <Field label="ADDED BY" value={account.added_by ?? `User ${account.user_id}`} readOnly />
                <Field label="COMMENT" value={account.comment ?? '—'} readOnly className="field--wide" />
              </FormSection>
            </div>
          )}
        </AsyncContent>
      </Panel>

      <Panel title="CHANGE HISTORY" className="page-panel">
        <EventLogTable key={logVersion} table="accounts" recordId={id} />
      </Panel>
    </>
  )
}
