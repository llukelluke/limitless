import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import { AuthField, AuthHeader } from '../../components/AuthForm.jsx'
import { formValues, passwordProblems } from '../../constants.js'

// 08 Forgot Password — choose a new password.
export function ResetPassword() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!state?.reset_token) return <Navigate to="/forgot-password" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    const { new_password, confirm_password } = formValues(event.currentTarget)
    const password = new_password ?? ''
    const problems = passwordProblems(password)
    if (problems.length) {
      setError(`Password must ${problems.join(', ')}.`)
      return
    }
    if (password !== confirm_password) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await api.resetPassword({ reset_token: state.reset_token, new_password: password })
      navigate('/forgot-password/done', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <AuthHeader title="Create New Password" subtitle="Choose a secure password for your account." />

      <div className="auth-form__fields">
        <AuthField
          label="New password"
          name="new_password"
          type="password"
          placeholder="Enter your new password."
          autoComplete="new-password"
        />
        <AuthField
          label="Confirm password"
          name="confirm_password"
          type="password"
          placeholder="Re-enter your new password."
          autoComplete="new-password"
        />
      </div>

      <div className="auth-requirements">
        <p className="auth-field__label">Password requirements</p>
        <p className="auth-requirements__text">
          8+ characters • Starts with a letter • Includes number • Includes special character • Not a previous
          password
        </p>
      </div>

      <div className="auth-form__actions">
        <Alert surface="dark">{error}</Alert>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting} title={"Save your new password"}>
          {submitting ? 'Saving…' : 'Reset Password'}
        </button>
      </div>

      <div className="auth-form__assist auth-form__assist--end">
        <Link to="/forgot-password" className="text-link">
          Start Over
        </Link>
      </div>
    </form>
  )
}

// 09 Password Updated
export function PasswordUpdated() {
  return (
    <>
      <p className="auth-check" aria-hidden="true">
        ✓
      </p>
      <div className="auth-form auth-confirm auth-updated">
        <AuthHeader title="Password Updated" subtitle="Your password has been successfully reset." />
        <Link to="/login" className="btn btn--primary btn--lg btn--block" title="Go to the sign-in page">
          Sign In
        </Link>
      </div>
    </>
  )
}
