import { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import { Field, FormActions, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { formValues, fullName, isSystemUser } from '../../constants.js'
import useApi from '../../hooks/useApi.js'

// 18 Admin Email — send an email to any user from inside the system.
export default function Email() {
  const messageId = useId()
  const [searchParams] = useSearchParams()
  const { data: users, error: loadError } = useApi(api.listUsers)
  const [feedback, setFeedback] = useState(null)
  const [sending, setSending] = useState(false)

  const recipientOptions = [
    { value: '', label: users ? 'Select User...' : 'Loading users…' },
    ...(users ?? [])
      .filter(isSystemUser)
      .map((user) => ({ value: String(user.id), label: `${fullName(user)} (${user.username})` })),
  ]

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const { recipient_id, subject, message } = formValues(form)
    if (!recipient_id || !subject || !message) {
      setFeedback({ tone: 'error', message: 'Choose a recipient and enter a subject and message.' })
      return
    }

    setSending(true)
    setFeedback(null)
    try {
      await api.sendEmail(recipient_id, { subject, body: message })
      const recipient = users.find((user) => String(user.id) === recipient_id)
      setFeedback({ tone: 'success', message: `Email sent to ${recipient.email_address}.` })
      form.reset()
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHeader title="Email Users" subtitle="Send messages to registered Limitless users." />

      <Panel as="form" title="SEND EMAIL" className="page-panel" onSubmit={handleSubmit} noValidate>
        <div className="form-body email-form">
          <Field
            key={users ? 'loaded' : 'loading'}
            label="RECIPIENT"
            name="recipient_id"
            options={recipientOptions}
            defaultValue={searchParams.get('to') ?? ''}
          />
          <Field label="SUBJECT" name="subject" placeholder="Enter Subject..." />
          <div className="field">
            <label className="field__label" htmlFor={messageId}>
              MESSAGE
            </label>
            <textarea id={messageId} name="message" className="field__textarea" placeholder="Type your message..." />
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
