import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, Field, FormActions, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import {
  ACCOUNT_CATEGORIES,
  NORMAL_SIDES,
  STATEMENTS,
  formValues,
  formatDateTime,
  formatMoney,
  formatOrder,
  parseMoney,
} from '../../constants.js'
import useApi from '../../hooks/useApi.js'

const statementOptions = STATEMENTS.map((s) => ({ value: s.value, label: `${s.label} — ${s.name}` }))
const categoryFor = (value) => ACCOUNT_CATEGORIES.find((c) => c.value === value)

// Form order, so focus goes to the first field with a problem
const FIELD_ORDER = ['name', 'number', 'category', 'subcategory', 'normal_side', 'statement', 'order', 'initial_balance']
const REQUIRED = ['name', 'number', 'category', 'subcategory', 'normal_side', 'statement', 'order']

// Returns { field: message } for every problem; empty when the form can be sent.
function accountErrors(values) {
  const errors = {}
  for (const key of REQUIRED) if (!values[key]) errors[key] = 'Required.'
  const category = categoryFor(values.category)
  if (values.number && !/^\d+$/.test(values.number)) {
    errors.number = 'Account number must contain digits only — no decimals or letters.'
  } else if (values.number && category && !values.number.startsWith(category.prefix)) {
    errors.number = `${category.label} account numbers must start with ${category.prefix}.`
  }
  if (values.order && !/^\d+$/.test(values.order)) errors.order = 'Order must be a whole number, for example 01.'
  if (Number.isNaN(parseMoney(values.initial_balance))) {
    errors.initial_balance = 'Must be an amount with at most two decimal places, for example 1,250.00.'
  }
  return errors
}

// Server messages that belong to one field are shown on that field instead of in the alert.
function fieldForServerError(message) {
  if (/name already exists/i.test(message)) return 'name'
  if (/number/i.test(message)) return 'number'
  if (/monetary/i.test(message)) return 'initial_balance'
  return null
}

const toMoneyText = (value) =>
  Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Add Account (no :id) and Edit Account (/accounts/:id/edit). Administrators only.
export default function AccountForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const { data: account, error, loading } = useApi(() => (editing ? api.getAccount(id) : Promise.resolve(null)), [id])

  return (
    <>
      <PageHeader
        eyebrow="CHART OF ACCOUNTS"
        title={editing ? 'Edit Account' : 'Add Account'}
        subtitle={editing ? 'Update the account information.' : 'Add a new account to the chart of accounts.'}
      />
      <AsyncContent loading={editing && loading && !account} error={error}>
        {(!editing || account) && (
          <AccountFormPanel key={account?.id ?? 'new'} account={account} navigate={navigate} />
        )}
      </AsyncContent>
    </>
  )
}

function AccountFormPanel({ account, navigate }) {
  const [category, setCategory] = useState(account?.category ?? '')
  const [side, setSide] = useState(account?.normal_side ?? '')
  const [feedback, setFeedback] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const backTo = account ? `/accounts/${account.id}` : '/accounts'
  const prefix = categoryFor(category)?.prefix

  // A new category suggests its normal side; the admin can still change it.
  const changeCategory = (event) => {
    setCategory(event.target.value)
    const suggested = categoryFor(event.target.value)?.side
    if (suggested) setSide(suggested)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(form)
    const showErrors = (next) => {
      setErrors(next)
      form.elements[FIELD_ORDER.find((key) => next[key])]?.focus()
    }

    const problems = accountErrors(values)
    setFeedback('')
    if (Object.keys(problems).length) {
      showErrors(problems)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const body = { ...values, initial_balance: parseMoney(values.initial_balance).toFixed(2) }
      const saved = account ? await api.updateAccount(account.id, body) : await api.createAccount(body)
      navigate(`/accounts/${saved.id}`, { state: { saved: account ? 'Changes saved.' : 'Account added.' } })
    } catch (err) {
      const field = fieldForServerError(err.message)
      if (field) showErrors({ [field]: err.message })
      else setFeedback(err.message)
      setSaving(false)
    }
  }

  return (
    <Panel
      as="form"
      title={account ? 'ACCOUNT DETAILS' : 'NEW ACCOUNT'}
      className="page-panel panel--form"
      onSubmit={handleSubmit}
      noValidate
      action={<BackLink to={backTo}>{account ? 'Back to Account' : 'Back to Chart of Accounts'}</BackLink>}
    >
      <div className="form-body">
        <p className="form-required-note">Fields marked * are required.</p>
        <FormSection title="ACCOUNT INFORMATION">
          <Field label="ACCOUNT NAME" name="name" required error={errors.name} defaultValue={account?.name ?? ''} placeholder="e.g. Cash" />
          <Field
            label="ACCOUNT NUMBER"
            name="number"
            required
            error={errors.number}
            inputMode="numeric"
            defaultValue={account?.number ?? ''}
            placeholder={prefix ? `${prefix}01` : 'e.g. 101'}
            // Digits only: decimals and letters are dropped as they are typed
            onInput={(event) => (event.target.value = event.target.value.replace(/\D/g, ''))}
            hint={prefix ? `${categoryFor(category).label} numbers start with ${prefix}` : '1 Asset · 2 Liability · 3 Equity · 4 Revenue · 5 Expense'}
          />
          <Field
            label="CATEGORY"
            name="category"
            required
            error={errors.category}
            options={[{ value: '', label: 'Select Category' }, ...ACCOUNT_CATEGORIES]}
            value={category}
            onChange={changeCategory}
          />
          <Field
            label="SUBCATEGORY"
            name="subcategory"
            required
            error={errors.subcategory}
            defaultValue={account?.subcategory ?? ''}
            placeholder="e.g. Current Assets"
          />
          <Field
            label="NORMAL SIDE"
            name="normal_side"
            required
            error={errors.normal_side}
            options={[{ value: '', label: 'Select Side' }, ...NORMAL_SIDES]}
            value={side}
            onChange={(event) => setSide(event.target.value)}
          />
          <Field
            label="STATEMENT"
            name="statement"
            required
            error={errors.statement}
            options={[{ value: '', label: 'Select Statement' }, ...statementOptions]}
            defaultValue={account?.statement ?? ''}
          />
          <Field
            label="ORDER"
            name="order"
            required
            error={errors.order}
            inputMode="numeric"
            defaultValue={account?.order == null ? '' : formatOrder(account.order)}
            placeholder="e.g. 01"
            onInput={(event) => (event.target.value = event.target.value.replace(/\D/g, ''))}
          />
          <Field
            label="DESCRIPTION"
            name="description"
            defaultValue={account?.description ?? ''}
            className="field--wide"
            placeholder="What this account is used for..."
          />
        </FormSection>

        <FormSection title="BALANCES">
          <Field
            label="INITIAL BALANCE"
            name="initial_balance"
            error={errors.initial_balance}
            inputMode="decimal"
            defaultValue={toMoneyText(account?.initial_balance)}
            onBlur={(event) => {
              const amount = parseMoney(event.target.value)
              if (!Number.isNaN(amount)) event.target.value = toMoneyText(amount)
            }}
          />
          {account && (
            <>
              <Field label="DEBIT" value={formatMoney(account.debit)} readOnly />
              <Field label="CREDIT" value={formatMoney(account.credit)} readOnly />
              <Field label="BALANCE" value={formatMoney(account.balance)} readOnly />
            </>
          )}
        </FormSection>

        <FormSection title="OTHER">
          <Field label="COMMENT" name="comment" defaultValue={account?.comment ?? ''} className="field--wide" />
          {account && (
            <>
              <Field label="DATE ADDED" value={formatDateTime(account.added_at)} readOnly />
              <Field label="ADDED BY" value={account.added_by ?? `User ${account.user_id}`} readOnly />
            </>
          )}
        </FormSection>

        <div className="form-feedback">
          <Alert>{feedback}</Alert>
        </div>
      </div>

      <FormActions>
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={saving}
          title={account ? 'Save changes to this account' : 'Add this account to the chart of accounts'}
        >
          {saving ? 'Saving…' : account ? 'Save Changes' : 'Add Account'}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          title="Discard changes and go back"
          onClick={() => navigate(backTo)}
        >
          Cancel
        </button>
      </FormActions>
    </Panel>
  )
}
