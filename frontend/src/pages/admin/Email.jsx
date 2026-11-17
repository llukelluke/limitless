import { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import Alert from '../../components/Alert.jsx'
import { Field, FormActions, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { ROLES, formValues, fullName, isAdmin, isSystemUser, labelFor, requiredErrors } from '../../constants.js'
import useApi from '../../hooks/useApi.js'
import { ATTACHMENT_TYPES } from '../../journal.js'
import '../journal/Journal.css'

const ACCEPT = ATTACHMENT_TYPES.map((ext) => `.${ext}`).join(',')
// The server takes at most 12 MB per request; keep files under that with room for the message.
const MAX_TOTAL = 10 * 1024 * 1024

// 18 Admin Email — send an email to any user from inside the system.
// Managers and accountants use the same page (/email) to reach any active user.
export default function Email() {
  const messageId = useId()
  const fileId = useId()
  const [files, setFiles] = useState([])
  const [searchParams] = useSearchParams()
  const { user: me } = useAuth()
  const admin = isAdmin(me)
  const { data: users, error: loadError } = useApi(admin ? api.listUsers : api.emailRecipients)
  const [feedback, setFeedback] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sending, setSending] = useState(false)

  const recipientOptions = [
    { value: '', label: users ? 'Select User...' : 'Loading users…' },
    ...(users ?? [])
      // Non-admins get { id, name, role } from /email/recipients, already limited to who they may email.
      .filter((user) => !admin || (isSystemUser(user) && user.id !== me.id))
      .map((user) => ({
        value: String(user.id),
        label: admin ? `${fullName(user)} (${user.username})` : `${user.name} (${labelFor(ROLES, user.role)})`,
      })),
  ]

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const { recipient_id, subject, message } = formValues(form)
    const missing = requiredErrors({ recipient_id, subject, message }, ['recipient_id', 'subject', 'message'])
    setFieldErrors(missing)
    if (Object.keys(missing).length) {
      setFeedback({ tone: 'error', message: 'Choose a recipient and enter a subject and message.' })
      return
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) {
      setFieldErrors({ files: true })
      setFeedback({ tone: 'error', message: 'Attachments can add up to at most 10 MB.' })
      return
    }

    setSending(true)
    setFeedback(null)
    try {
      const body = new FormData()
      body.append('recipient_user_id', recipient_id)
      body.append('subject', subject)
      body.append('body', message)
      files.forEach((file) => body.append('files', file))
      await api.emailUser(body)
      const recipient = users.find((user) => String(user.id) === recipient_id)
      setFeedback({ tone: 'success', message: `Email sent to ${admin ? recipient.email_address : recipient.name}.` })
      form.reset()
      setFiles([])
    } catch (err) {
      // ATT_001–003 (wrong type, empty, too large) are about the attached files
      if (/attach/i.test(err.message)) setFieldErrors({ files: true })
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Email Users"
        subtitle="Send messages to registered Limitless users."
      />

      <Panel as="form" title="Send email" className="page-panel" onSubmit={handleSubmit} noValidate>
        <div className="form-body email-form">
          <Field
            key={users ? 'loaded' : 'loading'}
            label="Recipient"
            className="field--narrow"
            name="recipient_id"
            options={recipientOptions}
            defaultValue={searchParams.get('to') ?? ''}
            error={fieldErrors.recipient_id}
          />
          <Field label="Subject" name="subject" className="field--narrow" error={fieldErrors.subject} placeholder="Enter Subject..." />
          <div className="field">
            <label className="field__label" htmlFor={messageId}>
              Message
            </label>
            <textarea
              id={messageId}
              name="message"
              className="field__textarea"
              placeholder="Type your message..."
              aria-invalid={fieldErrors.message ? true : undefined}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={fileId}>
              Attachments (PDF, Word, Excel, CSV, JPG, PNG)
            </label>
            <input
              id={fileId}
              type="file"
              multiple
              accept={ACCEPT}
              className="journal-files__input"
              title="Attach files to this email"
              aria-invalid={fieldErrors.files ? true : undefined}
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
          </div>
          {loadError && <Alert>{loadError.message}</Alert>}
          {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}
        </div>

        <FormActions>
          <button type="submit" className="btn btn--primary btn--sm" disabled={sending} title="Send this email to the selected user">
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </FormActions>
      </Panel>
    </>
  )
}
