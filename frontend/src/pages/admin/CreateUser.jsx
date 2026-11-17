import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import { BackLink, Field, FormActions, FormSection, PageHeader, Panel } from '../../components/AdminUI.jsx'
import { ROLES, formValues, requiredErrors } from '../../constants.js'

const roleOptions = [{ value: '', label: 'Select Role' }, ...ROLES]

// 19 Create User — administrator creates an account and assigns a role.
export default function CreateUser() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(form)
    const missing = requiredErrors(values, ['first_name', 'last_name', 'email_address', 'role'])
    setFieldErrors(missing)
    if (Object.keys(missing).length) {
      setError('First name, last name, email address, and role are required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      setCreated(await api.createUser(values))
      form.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Create User" subtitle="Create a new user account and assign a role." />

      <Panel
        as="form"
        title="Create user"
        className="page-panel panel--form"
        onSubmit={handleSubmit}
        noValidate
        action={<BackLink to="/admin/users">Back to Users</BackLink>}
      >
        <div className="form-body">
          <FormSection title="Account information">
            <Field label="First name" name="first_name" error={fieldErrors.first_name} placeholder="Enter first name..." />
            <Field label="Last name" name="last_name" error={fieldErrors.last_name} placeholder="Enter last name..." />
            <Field label="Email address" name="email_address" type="email" error={fieldErrors.email_address} placeholder="Enter email..." />
            <Field label="Date of birth" name="birth_date" type="date" />
            <Field label="Address" name="home_address" placeholder="Enter address..." />
            <Field label="Role" name="role" error={fieldErrors.role} options={roleOptions} defaultValue="" />
            <Field
              label="Username"
              value="Generated automatically"
              readOnly
              className="field--stack"
              hint="First initial → Full last name → account creation MM/YY"
            />
          </FormSection>

          <div className="form-feedback">
            <Alert>{error}</Alert>
            {created && (
              <Alert tone="success">
                Created <strong>{created.user.username}</strong>. Temporary password:{' '}
                <strong className="secret">{created.temporary_password}</strong> — share it with the user securely;
                it expires in 24 hours and won&apos;t be shown again. <Link to={`/admin/users/${created.user.id}`}>View user →</Link>
              </Alert>
            )}
          </div>
        </div>

        <FormActions>
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving} title="Create this user account">
            {saving ? 'Creating…' : 'Create User'}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" title="Discard changes and go back to users" onClick={() => navigate('/admin/users')}>
            Cancel
          </button>
        </FormActions>
      </Panel>
    </>
  )
}
