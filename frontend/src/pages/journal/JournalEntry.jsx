import { useId, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, DataTable, Field, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { formatDate, formatDateTime, formatMoney, labelFor } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { ENTRY_TYPES, sortedLines } from '../../journal.js'
import { StatusBadge } from './JournalList.jsx'
import './Journal.css'

const money = (key) => ({
  key,
  header: <span className="num">{key.toUpperCase()}</span>,
  width: '20%',
  render: (row) => <span className="num">{row[key] === null ? '' : formatMoney(row[key])}</span>,
})

const columns = [
  {
    key: 'account',
    header: 'ACCOUNT',
    render: (row) =>
      row.account_id ? (
        <Link
          to={`/accounts/${row.account_id}/ledger`}
          className={row.debit === null ? 'journal-lines__credit' : undefined}
          title={`Open the ledger for ${row.account_name}`}
        >
          {row.account_number} · {row.account_name}
        </Link>
      ) : (
        <strong>{row.account_name}</strong>
      ),
  },
  money('debit'),
  money('credit'),
]

// One journal entry. Managers approve or reject pending entries here; a rejection needs a reason.
export default function JournalEntry() {
  const { id } = useParams()
  const { state } = useLocation()
  const { user } = useAuth()
  const commentId = useId()
  const { data: entry, error, loading, reload } = useApi(() => api.getJournalEntry(id), [id])
  const [feedback, setFeedback] = useState(state?.saved ? { tone: 'success', message: state.saved } : null)
  const [comment, setComment] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)

  const canReview = user.role === 'MANAGER' && entry?.status === 'SUBMITTED'
  const rows = entry && [
    ...sortedLines(entry).map((line) => ({
      ...line,
      debit: line.side === 'DEBIT' ? line.amount : null,
      credit: line.side === 'CREDIT' ? line.amount : null,
    })),
    { id: 'total', account_name: 'Totals', debit: entry.total_debits, credit: entry.total_credits },
  ]

  const review = async (action) => {
    setBusy(true)
    try {
      if (action === 'approve') await api.approveJournalEntry(entry.id)
      else await api.rejectJournalEntry(entry.id, comment.trim())
      setFeedback({ tone: 'success', message: action === 'approve' ? 'Entry approved and posted to the ledger.' : 'Entry rejected.' })
      setRejecting(false)
      reload()
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setBusy(false)
    }
  }

  const download = (attachment) =>
    api.downloadAttachment(entry.id, attachment).catch((err) => setFeedback({ tone: 'error', message: err.message }))

  return (
    <>
      <PageHeader
        eyebrow="JOURNALIZING"
        title={entry ? `Journal Entry JE-${entry.id}` : 'Journal Entry'}
        subtitle="Accounts debited and credited, source documents, and approval status."
      />

      <Panel title="JOURNAL ENTRY" className="page-panel" action={<BackLink to="/journal">Back to Journal</BackLink>}>
        <AsyncContent loading={loading && !entry} error={error}>
          {entry && (
            <div className="form-body">
              {feedback && (
                <div className="form-feedback">
                  <Alert tone={feedback.tone}>{feedback.message}</Alert>
                </div>
              )}

              {canReview && (
                <div className="account-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busy}
                    title="Approve this entry and post it to the ledger"
                    onClick={() => review('approve')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busy}
                    title="Reject this entry with a reason"
                    onClick={() => setRejecting(true)}
                  >
                    Reject
                  </button>
                </div>
              )}

              {canReview && rejecting && (
                <div className="journal-reject">
                  <label className="field__label" htmlFor={commentId}>
                    REASON FOR REJECTION <span className="field__required">*</span>
                  </label>
                  <textarea
                    id={commentId}
                    className="field__textarea"
                    placeholder="Tell the preparer what to fix…"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <div className="account-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={busy || !comment.trim()}
                      title="Reject this entry"
                      onClick={() => review('reject')}
                    >
                      Confirm Rejection
                    </button>
                    <button type="button" className="text-link" onClick={() => setRejecting(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <FormSection title="ENTRY">
                <div className="field">
                  <span className="field__label">STATUS</span>
                  <StatusBadge status={entry.status} />
                </div>
                <Field label="DATE" value={formatDate(entry.entry_date)} readOnly />
                <Field label="TYPE" value={labelFor(ENTRY_TYPES, entry.entry_type)} readOnly />
                <Field label="PREPARED BY" value={entry.created_by_name ?? '—'} readOnly />
                <Field label="SUBMITTED" value={formatDateTime(entry.created_at)} readOnly />
                {entry.reviewed_by && <Field label="REVIEWED BY" value={entry.reviewed_by_name} readOnly />}
                {entry.reviewed_at && <Field label="REVIEWED" value={formatDateTime(entry.reviewed_at)} readOnly />}
                <Field label="DESCRIPTION" value={entry.description ?? '—'} readOnly className="field--wide" />
                {entry.comment && <Field label="COMMENT" value={entry.comment} readOnly className="field--wide" />}
              </FormSection>

              <DataTable columns={columns} rows={rows} caption={`Lines of journal entry JE-${entry.id}`} />

              <FormSection title="SOURCE DOCUMENTS">
                {entry.attachments?.length ? (
                  <ul className="journal-files">
                    {entry.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <button
                          type="button"
                          className="text-link"
                          title={`Download ${attachment.original_name}`}
                          onClick={() => download(attachment)}
                        >
                          {attachment.original_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="async-status">No documents attached.</p>
                )}
              </FormSection>
            </div>
          )}
        </AsyncContent>
      </Panel>
    </>
  )
}
