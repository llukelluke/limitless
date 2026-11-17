import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import AsyncContent from '../../components/AsyncContent.jsx'
import { BackLink, Field, FormActions, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { ROLES, STATUSES, formValues, formatDate, passwordStatus, requiredErrors } from '../../constants.js'
import useApi from '../../hooks/useApi.js'

const statusOptions = STATUSES.filter((option) => option.value !== 'PENDING')

const fieldError = (message, fields) => Object.assign(new Error(message), { fields })

// Applies the form to the API: profile fields first, then any status or suspension change.
async function saveUser(user, values) {
  const { status, suspension_start: start, suspension_end: end, ...profile } = values
  const datesChanged = start !== user.suspension_start || end !== user.suspension_end

  if (datesChanged && (start || end)) {
    if (!start || !end) throw fieldError('Enter both a suspension start date and an expiry date.', requiredErrors(values, ['suspension_start', 'suspension_end']))
    if (end <= start) throw fieldError('Suspension expiry date must be after the start date.', { suspension_end: 'Must be after the start date.' })
  } else if (status === 'SUSPENDED' && user.status !== 'SUSPENDED') {
    throw fieldError('To suspend this user, choose a suspension start date and expiry date.', requiredErrors(values, ['suspension_start', 'suspension_end']))
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
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [tempPassword, setTempPassword] = useState(null)

  const issueTemporaryPassword = async () => {
    setFeedback(null)
    try {
      const { temporary_password } = await api.issueTemporaryPassword(user.id)
      setTempPassword(temporary_password)
      reload()
    } catch (err) {
      setFeedback({ tone: 'error', message: err.message })
    }
  }

  if (user?.status === 'PENDING') return <Navigate to={`/admin/access-requests/${user.id}`} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    const missing = requiredErrors(values, ['first_name', 'last_name', 'email_address'])
    setFieldErrors(missing)
    if (Object.keys(missing).length) {
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
      setFieldErrors(err.fields ?? {})
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
        title="User details"
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
                <FormSection title="Account information">
                  <Field label="First name" name="first_name" error={fieldErrors.first_name} defaultValue={user.first_name ?? ''} />
                  <Field label="Last name" name="last_name" error={fieldErrors.last_name} defaultValue={user.last_name ?? ''} />
                  <Field label="Email address" name="email_address" type="email" error={fieldErrors.email_address} defaultValue={user.email_address ?? ''} />
                  <Field label="Username" value={user.username ?? ''} readOnly />
                  <Field label="Address" name="home_address" defaultValue={user.home_address ?? ''} className="field--wide" />
                  <Field label="Date of birth" name="birth_date" type="date" defaultValue={user.birth_date ?? ''} />
                  <Field label="Picture URL" name="picture" type="url" defaultValue={user.picture ?? ''} placeholder="https://…" />
                  <Field label="Role" name="role" options={ROLES} defaultValue={user.role ?? 'ACCOUNTANT'} />
                  <Field label="Account status" name="status" options={statusOptions} defaultValue={user.status} />
                </FormSection>

                <FormSection title="Account access">
                  <Field label="Password status" value={passwordStatus(user)} readOnly className="field--stack" />
                  <Field
                    label="Password expiration"
                    value={user.password_expiry ? `Expires ${formatDate(user.password_expiry)}` : '—'}
                    readOnly
                    className="field--stack"
                  />
                  <div className="field field--wide">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      title="Replace this user's password with a new temporary one that expires in 24 hours"
                      onClick={issueTemporaryPassword}
                    >
                      Issue Temporary Password
                    </button>
                  </div>
                </FormSection>

                <FormSection title="Scheduled suspension">
                  <Field label="Start date" name="suspension_start" type="date" error={fieldErrors.suspension_start} defaultValue={user.suspension_start ?? ''} />
                  <Field label="Expiry date" name="suspension_end" type="date" error={fieldErrors.suspension_end} defaultValue={user.suspension_end ?? ''} />
                </FormSection>
              </div>
            )}
            {(feedback || tempPassword) && (
              <div className="form-feedback">
                {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}
                {tempPassword && (
                  <Alert tone="success">
                    New temporary password: <strong className="secret">{tempPassword}</strong>. Share it with the user
                    securely; it expires in 24 hours and won&apos;t be shown again.
                  </Alert>
                )}
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
