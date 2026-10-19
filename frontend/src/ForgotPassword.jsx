import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './ForgotPassword.css'
import { requestPasswordReset } from './api/passwordApi'

function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [securityAnswer1, setSecurityAnswer1] = useState('')
  const [securityAnswer2, setSecurityAnswer2] = useState('')
  const [securityAnswer3, setSecurityAnswer3] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = (event) => {
    event.preventDefault()

    setMessage('')
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setStep(2)
  }

  const handleVerificationSubmit = async (event) => {
    event.preventDefault()

    setMessage('')
    setError('')

    if (
      !username.trim() ||
      !email.trim() ||
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      setError('Please complete all fields.')
      return
    }

    setLoading(true)

    try {
      const data = await requestPasswordReset({
        username,
        email_address: email,
        security_answer1: securityAnswer1,
        security_answer2: securityAnswer2,
        security_answer3: securityAnswer3,
      })

      // Continue to the new-password screen (08) with the token from the API
      navigate('/forgot-password/reset', {
        replace: true,
        state: { reset_token: data.reset_token },
      })
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setError('')
    setMessage('')
    setStep(1)
  }

  if (step === 1) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-password-card">
          <h1>Forgot Password?</h1>

          <p className="forgot-password-description">
            Enter the email address associated with your account and we'll
            send you a link to reset your password.
          </p>

          <form onSubmit={handleEmailSubmit}>
            <label htmlFor="forgot-password-email">
              Email Address
            </label>

            <input
              id="forgot-password-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {error && (
              <p className="forgot-password-error">
                {error}
              </p>
            )}

            <button type="submit" title="Check your details and continue to reset your password">
              Send Reset Link
            </button>
          </form>

          <Link to="/login" className="forgot-password-back">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-card">
        <h1>Verify Your Information</h1>

        <p className="forgot-password-description">
          Enter your account information and answer your security questions
          to continue resetting your password.
        </p>

        <form onSubmit={handleVerificationSubmit}>
          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="verification-email">
            Email Address
          </label>

          <input
            id="verification-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="security-answer1">
            Security Answer 1
          </label>

          <input
            id="security-answer1"
            type="text"
            placeholder="Enter your answer"
            value={securityAnswer1}
            onChange={(event) => setSecurityAnswer1(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="security-answer2">
            Security Answer 2
          </label>

          <input
            id="security-answer2"
            type="text"
            placeholder="Enter your answer"
            value={securityAnswer2}
            onChange={(event) => setSecurityAnswer2(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="security-answer3">
            Security Answer 3
          </label>

          <input
            id="security-answer3"
            type="text"
            placeholder="Enter your answer"
            value={securityAnswer3}
            onChange={(event) => setSecurityAnswer3(event.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="forgot-password-error">
              {error}
            </p>
          )}

          {message && (
            <p className="forgot-password-success">
              {message}
            </p>
          )}

          <button type="submit" disabled={loading} title="Verify your security answers">
            {loading ? 'Verifying...' : 'Verify Information'}
          </button>
        </form>

        <button
          type="button"
          className="forgot-password-back"
          onClick={handleBack}
          title="Go back to the previous step"
          disabled={loading}
        >
          Back
        </button>
      </div>
    </div>
  )
}

export default ForgotPassword