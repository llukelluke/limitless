import { useId, useState } from 'react'
import eyeIcon from '../assets/brand/eye.png'

export function AuthHeader({ title, subtitle }) {
  return (
    <header className="auth-form__header">
      <h1 className="auth-form__title">{title}</h1>
      {subtitle && <p className="auth-form__subtitle">{subtitle}</p>}
    </header>
  )
}

// Gold label above an underlined input. `labelAction` renders on the right of the label row.
export function AuthField({ label, labelAction, prompt, type = 'text', ...inputProps }) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="auth-field">
      <div className="auth-field__label-row">
        <label className="auth-field__label" htmlFor={id}>
          {label}
        </label>
        {labelAction}
      </div>
      {prompt && <p className="auth-field__prompt">{prompt}</p>}
      <div className="auth-field__control">
        <input
          id={id}
          className="auth-field__input"
          type={isPassword && revealed ? 'text' : type}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-field__toggle"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            title={revealed ? "Hide password" : "Show password"}
            onClick={() => setRevealed((value) => !value)}
          >
            <img src={eyeIcon} alt="" width="20" height="20" />
          </button>
        )}
      </div>
    </div>
  )
}
