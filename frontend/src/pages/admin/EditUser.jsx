import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, Field, FormActions, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { ROLES, STATUSES, formValues, formatDate, passwordStatus } from '../../constants.js'
import useApi from '../../hooks/useApi.js'

const statusOptions = STATUSES.filter((option) => option.value !== 'PENDING')

// Applies the form to the API: profile fields first, then any status or suspension change.
async function saveUser(user, values) {
  const { status, suspension_start: start, suspension_end: end, ...profile } = values
  const datesChanged = start !== user.suspension_start || end !== user.suspension_end

  if (datesChanged && (start || end)) {
    if (!start || !end) throw new Error('Enter both a suspension start date and an expiry date.')
    if (end <= start) throw new Error('Suspension expiry date must be after the start date.')
  } else if (status === 'SUSPENDED' && user.status !== 'SUSPENDED') {
    throw new Error('To suspend this user, choose a suspension start date and expiry date.')
  }

  await api.updateUser(user.id, profile)

  if (datesChanged && start && end) {
    await api.suspendUser(user.id, { suspension_start: start, suspension_end: end })
  } else if (status !== user.status) {
    if (status === 'ACTIVATED') await api.activateUser(user.id)
    if (status === 'DEACTIVATED') await api.deactivateUser(user.id)
  }
}

// 12 User Details / Edit User — update info, role, activate/deactivate, schedule a suspension.
export default function EditUser() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: user, error, loading, reload } = useApi(() => api.getUser(id), [id])
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  if (user?.status === 'PENDING') return <Navigate to={`/admin/access-requests/${user.id}`} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    if (!values.first_name || !values.last_name || !values.email_address) {
      setFeedback({ tone: 'error', message: 'First name, last name, and email address are required.' })
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      await saveUser(user, values)
      setFeedback({ tone: 'success', message: 'Changes saved.' })
      reload()
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Edit User" subtitle="Update account information, role, and access." />

      <Panel
        as="form"
        title="USER DETAILS"
        className="page-panel panel--form"
        onSubmit={handleSubmit}
        noValidate
        action={<BackLink to="/admin/users">Back to Users</BackLink>}
      >
        <div className="form-body">
          <AsyncContent loading={loading && !user} error={error}>
            {user && (
              // Re-mount the fields after each save so they show the stored values.
              <div key={JSON.stringify(user)}>
                <FormSection title="ACCOUNT INFORMATION">
                  <Field label="FIRST NAME" name="first_name" defaultValue={user.first_name ?? ''} />
                  <Field label="LAST NAME" name="last_name" defaultValue={user.last_name ?? ''} />
                  <Field label="EMAIL ADDRESS" name="email_address" type="email" defaultValue={user.email_address ?? ''} />
                  <Field label="USERNAME" value={user.username ?? ''} readOnly />
                  <Field label="ADDRESS" name="home_address" defaultValue={user.home_address ?? ''} className="field--wide" />
                  <Field label="DATE OF BIRTH" name="birth_date" type="date" defaultValue={user.birth_date ?? ''} />
                  <Field label="PICTURE URL" name="picture" type="url" defaultValue={user.picture ?? ''} placeholder="https://…" />
                  <Field label="ROLE" name="role" options={ROLES} defaultValue={user.role ?? 'ACCOUNTANT'} />
                  <Field label="ACCOUNT STATUS" name="status" options={statusOptions} defaultValue={user.status} />
                </FormSection>

                <FormSection title="ACCOUNT ACCESS">
                  <Field label="PASSWORD STATUS" value={passwordStatus(user)} readOnly className="field--stack" />
                  <Field
                    label="PASSWORD EXPIRATION"
                    value={user.password_expiry ? `Expires ${formatDate(user.password_expiry)}` : '—'}
                    readOnly
                    className="field--stack"
                  />
                </FormSection>

                <FormSection title="SCHEDULED SUSPENSION">
                  <Field label="START DATE" name="suspension_start" type="date" defaultValue={user.suspension_start ?? ''} />
                  <Field label="EXPIRY DATE" name="suspension_end" type="date" defaultValue={user.suspension_end ?? ''} />
                </FormSection>
              </div>
            )}
            {feedback && (
              <div className="form-feedback">
                <Alert tone={feedback.tone}>{feedback.message}</Alert>
              </div>
            )}
          </AsyncContent>
        </div>

        <FormActions>
          <button type="submit" className="btn btn--primary btn--sm" disabled={!user || saving} title="Save changes to this user">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" title="Discard changes and go back to users" onClick={() => navigate('/admin/users')}>
            Cancel
          </button>
        </FormActions>
      </Panel>
    </>
  )
}
