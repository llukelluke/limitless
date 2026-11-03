import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../../components/Alert.jsx'
import { AuthField, AuthHeader } from '../../components/AuthForm.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { formValues, homePathFor } from '../../constants.js'

// 03 Login — three wrong passwords suspend the account (enforced by the API).
export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homePathFor(user)} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    const { username, password } = formValues(event.currentTarget)
    const missing = {
      username: username?.trim() ? '' : 'Enter your username.',
      password: password ? '' : 'Enter your password.',
    }
    setFieldErrors(missing)
    setError('')
    if (missing.username || missing.password) return

    setSubmitting(true)
    try {
      const signedIn = await login(username, password)
      const from = location.state?.from
      const canReturn = from && (signedIn.role === 'ADMINISTRATOR' || !from.startsWith('/admin'))
      navigate(canReturn ? from : homePathFor(signedIn), { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} onReset={() => {
      setError('')
      setFieldErrors({})
    }} noValidate>
      <AuthHeader title="Welcome to Limitless" subtitle="Sign in to access your financial workspace." />

      <div className="auth-form__fields">
        <AuthField label="Username" name="username" placeholder="Enter your username." autoComplete="username" error={fieldErrors.username} />
        <AuthField
          label="Password"
          name="password"
          type="password"
          placeholder="••••••••••••"
          autoComplete="current-password"
          error={fieldErrors.password}
          labelAction={
            <Link to="/forgot-password" className="text-link text-link--muted">
              Forgot Password?
            </Link>
          }
        />
      </div>

      <div className="auth-form__actions">
        <Alert surface="dark">{error}</Alert>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting} title={"Sign in to Limitless"}>
          {submitting ? 'Signing In…' : 'Sign In'}
        </button>
        <button type="reset" className="btn btn--secondary btn--lg btn--block" disabled={submitting} title="Clear the username and password">
          Clear
        </button>
        <Link to="/request-access" className="btn btn--secondary btn--lg btn--block" title="Request a new Limitless account">
          Request Access / Create Account
        </Link>
      </div>

      <div className="auth-form__assist">
        <span className="auth-form__muted">Need assistance?</span>
        <a href="mailto:admin@limitless.local" className="text-link">
          Contact Support
        </a>
      </div>
    </form>
  )
}
