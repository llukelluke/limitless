import { useId, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, Field, FormActions, FormSection, PageHeader, Panel, Select } from '../../components/AdminUI.jsx'
import { formatMoney, isAdmin, parseMoney, todayIso } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import useErrorMessages from '../../hooks/useErrorMessages.js'
import { ATTACHMENT_TYPES, ENTRY_TYPES, validateEntry } from '../../journal.js'
import './Journal.css'

let nextKey = 0
const newLine = (side) => ({ key: nextKey++, side, account_id: '', amount: '' })
const blankDraft = () => ({
  entry_date: todayIso(),
  entry_type: 'REGULAR',
  description: '',
  lines: [newLine('LEFT'), newLine('RIGHT')],
})

const ACCEPT = ATTACHMENT_TYPES.map((ext) => `.${ext}`).join(',')

// Problems shown in red; each one names the line to fix and disappears once it is fixed.
export function ProblemList({ problems }) {
  const message = useErrorMessages()
  if (!problems.length) return null
  return (
    <Alert>
      <ul className="journal-problems">
        {problems.map((p, index) => (
          <li key={index}>
            {p.where && <strong>{p.where}: </strong>}
            {message(p.code)}
            {p.extra && ` ${p.extra}`}
          </li>
        ))}
      </ul>
    </Alert>
  )
}

function SideSection({ side, title, lines, accountOptions, onChange, onAdd, onRemove }) {
  const own = lines.filter((line) => line.side === side)
  const total = own.reduce((sum, line) => sum + (parseMoney(line.amount) || 0), 0)
  const label = side === 'LEFT' ? 'debit' : 'credit'
  return (
    <fieldset className="form-section journal-side">
      <legend className="form-section__title">{title}</legend>
      {own.map((line, index) => (
        <div key={line.key} className={`journal-line ${side === 'RIGHT' ? 'journal-line--credit' : ''}`}>
          <Select
            wrapClassName="journal-line__account"
            className="field__control field__control--select"
            aria-label={`Account for ${label} line ${index + 1}`}
            title="Only accounts in the chart of accounts can be used"
            options={accountOptions}
            value={line.account_id}
            onChange={(event) => onChange(line.key, 'account_id', event.target.value)}
          />
          <input
            className="field__control journal-line__amount"
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount for ${label} line ${index + 1}`}
            title={`Amount to ${label}`}
            value={line.amount}
            onChange={(event) => onChange(line.key, 'amount', event.target.value)}
          />
          <button
            type="button"
            className="text-link"
            title={`Remove ${label} line ${index + 1}`}
            aria-label={`Remove ${label} line ${index + 1}`}
            onClick={() => onRemove(line.key)}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="journal-side__foot">
        <button type="button" className="btn btn--secondary btn--sm" title={`Add another ${label}`} onClick={() => onAdd(side)}>
          Add {label === 'debit' ? 'Debit' : 'Credit'}
        </button>
        <span className="journal-side__total">
          Total {label}s: <strong>{formatMoney(total)}</strong>
        </span>
      </div>
    </fieldset>
  )
}

// Prepare a journal entry: debits first, then credits, plus source documents.
// Nothing is saved until Submit; Reset starts over and Cancel leaves without saving.
export default function JournalForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileId = useId()
  const descriptionId = useId()
  const { data: accounts, error, loading } = useApi(api.listAccounts)
  const [draft, setDraft] = useState(blankDraft)
  const [files, setFiles] = useState([])
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  if (isAdmin(user)) return <Navigate to="/journal" replace />

  const accountOptions = [
    { value: '', label: 'Select account…' },
    ...(accounts ?? [])
      .filter((account) => account.active)
      .sort((a, b) => a.number - b.number)
      .map((account) => ({ value: String(account.id), label: `${account.number} · ${account.name}` })),
  ]
  const problems = validateEntry(draft, files)

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }))
  const changeLine = (key, field, value) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    }))
  const addLine = (side) => setDraft((current) => ({ ...current, lines: [...current.lines, newLine(side)] }))
  const removeLine = (key) => setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }))

  const reset = () => {
    setDraft(blankDraft())
    setFiles([])
    setAttempted(false)
    setSubmitError(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    if (problems.length) return

    const lines = ['LEFT', 'RIGHT'].flatMap((side) =>
      draft.lines
        .filter((line) => line.side === side)
        .map((line) => ({ account_id: Number(line.account_id), side, amount: parseMoney(line.amount) })),
    )
    const form = new FormData()
    const entry = { ...draft, description: draft.description.trim() || null, lines }
    form.append('entry', new Blob([JSON.stringify(entry)], { type: 'application/json' }))
    files.forEach((file) => form.append('files', file))

    setBusy(true)
    setSubmitError(null)
    try {
      const saved = await api.createJournalEntry(form)
      navigate(`/journal/${saved.id}`, { state: { saved: 'Journal entry submitted for approval.' } })
    } catch (err) {
      setSubmitError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="JOURNALIZING" title="New Journal Entry" subtitle="Debits first, then credits. Totals must match." />

      <Panel
        as="form"
        title="JOURNAL ENTRY"
        className="page-panel"
        action={<BackLink to="/journal">Back to Journal</BackLink>}
        onSubmit={submit}
        noValidate
      >
        <AsyncContent loading={loading} error={error}>
          <div className="form-body">
            <FormSection title="ENTRY">
              <Field label="DATE" type="date" required value={draft.entry_date} onChange={set('entry_date')} />
              <Field label="TYPE" options={ENTRY_TYPES} value={draft.entry_type} onChange={set('entry_type')} />
              <div className="field field--wide">
                <label className="field__label" htmlFor={descriptionId}>
                  DESCRIPTION
                </label>
                <textarea
                  id={descriptionId}
                  className="field__textarea journal-description"
                  placeholder="Optional"
                  value={draft.description}
                  onChange={set('description')}
                />
              </div>
            </FormSection>

            {[
              ['LEFT', 'DEBITS'],
              ['RIGHT', 'CREDITS'],
            ].map(([side, title]) => (
              <SideSection
                key={side}
                side={side}
                title={title}
                lines={draft.lines}
                accountOptions={accountOptions}
                onChange={changeLine}
                onAdd={addLine}
                onRemove={removeLine}
              />
            ))}

            <fieldset className="form-section">
              <legend className="form-section__title">SOURCE DOCUMENTS</legend>
              <label className="field__label" htmlFor={fileId}>
                ATTACH FILES (PDF, WORD, EXCEL, CSV, JPG, PNG)
              </label>
              <input
                id={fileId}
                type="file"
                multiple
                accept={ACCEPT}
                className="journal-files__input"
                title="Attach source documents to this entry"
                onChange={(event) => {
                  const picked = [...event.target.files]
                  setFiles((current) => [...current, ...picked])
                  event.target.value = ''
                }}
              />
              {files.length > 0 && (
                <ul className="journal-files">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      {file.name}{' '}
                      <button
                        type="button"
                        className="text-link"
                        title={`Remove ${file.name}`}
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <div className="form-feedback">
              {attempted && <ProblemList problems={problems} />}
              {submitError && <Alert>{submitError}</Alert>}
            </div>
          </div>

          <FormActions>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={busy || (attempted && problems.length > 0)}
              title={attempted && problems.length ? 'Fix the errors above before submitting' : 'Submit this entry for manager approval'}
            >
              {busy ? 'Submitting…' : 'Submit for Approval'}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" title="Clear the form and start over" onClick={reset}>
              Reset
            </button>
            <button type="button" className="btn btn--secondary btn--sm" title="Leave without saving" onClick={() => navigate('/journal')}>
              Cancel
            </button>
          </FormActions>
        </AsyncContent>
      </Panel>
    </>
  )
}
