import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client.js'
import Alert from '../../components/Alert.jsx'
import { AuthField, AuthHeader } from '../../components/AuthForm.jsx'
import { SECURITY_QUESTIONS, formValues } from '../../constants.js'

// 04 Request Access — first-time users ask the administrator for an account.
export default function RequestAccess() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    const missing = ['first_name', 'last_name', 'email_address', 'home_address', 'birth_date'].some(
      (key) => !values[key],
    )
    if (missing) {
      setError('Please fill in your first name, last name, email address, address, and date of birth.')
      return
    }
    if (SECURITY_QUESTIONS.some((_, index) => !values[`security_answer${index + 1}`])) {
      setError('Please answer all three security questions. You will need them to reset your password.')
      return
    }

    const body = { ...values }
    SECURITY_QUESTIONS.forEach((question, index) => {
      body[`security_question${index + 1}`] = question
    })

    setSubmitting(true)
    setError('')
    try {
      await api.requestAccess(body)
      navigate('/request-access/submitted')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <AuthHeader title="Request Access" subtitle="Create your Limitless Account Request." />

      <div className="auth-form__fields">
        <div className="auth-form__row">
          <AuthField label="First name" name="first_name" placeholder="Enter your first name." autoComplete="given-name" />
          <AuthField label="Last name" name="last_name" placeholder="Enter your last name." autoComplete="family-name" />
        </div>
        <AuthField
          label="Email address"
          name="email_address"
          type="email"
          placeholder="Enter your email address."
          autoComplete="email"
        />
        <AuthField label="Address" name="home_address" placeholder="Enter your address." autoComplete="street-address" />
        <AuthField label="Date of birth" name="birth_date" type="date" autoComplete="bday" />

        <p className="auth-form__section">Security questions</p>
        {SECURITY_QUESTIONS.map((question, index) => (
          <AuthField
            key={question}
            label={`Security question ${index + 1}`}
            prompt={question}
            name={`security_answer${index + 1}`}
            placeholder="Enter your answer..."
            autoComplete="off"
          />
        ))}
      </div>

      <div className="auth-form__actions">
        <Alert surface="dark">{error}</Alert>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting} title={"Send your access request to an administrator"}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>

      <div className="auth-form__assist">
        <span className="auth-form__muted">Already have an account?</span>
        <Link to="/login" className="text-link">
          Back to Sign In
        </Link>
      </div>
    </form>
  )
}
