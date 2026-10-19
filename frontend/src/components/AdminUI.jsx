import { useId } from 'react'
import { Link } from 'react-router-dom'
import caretIcon from '../assets/brand/caret.svg'
import lockIcon from '../assets/brand/lock.svg'
import './AdminUI.css'

export function PageHeader({ eyebrow = 'USER ADMINISTRATION', title, subtitle }) {
  return (
    <header className="page-header">
      <p className="page-header__eyebrow">{eyebrow}</p>
      <h1 className="page-header__title">{title}</h1>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  )
}

// Cream content card. `action` renders on the right of the title row (back link, add button…).
export function Panel({ title, action, children, className = '', as: Tag = 'section', ...props }) {
  return (
    <Tag className={`panel ${className}`} {...props}>
      {(title || action) && (
        <div className="panel__head">
          {title && <h2 className="panel__title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="text-link text-link--strong">
      ← {children}
    </Link>
  )
}

export function FormSection({ title, children }) {
  return (
    <fieldset className="form-section">
      <legend className="form-section__title">{title}</legend>
      <div className="form-section__grid">{children}</div>
    </fieldset>
  )
}

// Native select with the design's grey caret. `options`: [{ value, label }]
export function Select({ options, className = '', wrapClassName = '', ...selectProps }) {
  return (
    <span className={`select ${wrapClassName}`}>
      <select className={className} {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <img className="select__caret" src={caretIcon} alt="" width="8.66" height="6.75" />
    </span>
  )
}

// Small pill input used on the admin forms. Pass `options` for a select, `readOnly` for a locked field.
export function Field({ label, options, readOnly, hint, error, className = '', ...controlProps }) {
  const id = useId()
  const controlClass = `field__control ${readOnly ? 'field__control--locked' : ''} ${error ? 'field__control--invalid' : ''}`
  // The error replaces the hint, and screen readers announce whichever is shown
  const describedBy = error || hint ? `${id}-note` : undefined
  const a11y = { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy }

  let control
  if (options) {
    control = (
      <Select
        id={id}
        options={options}
        className={`${controlClass} field__control--select`}
        {...a11y}
        {...controlProps}
      />
    )
  } else {
    control = <input id={id} className={controlClass} readOnly={readOnly} {...a11y} {...controlProps} />
  }

  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {controlProps.required && (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className="field__wrap">
        {control}
        {readOnly && <img className="field__lock" src={lockIcon} alt="" width="12.5" height="13.67" />}
      </div>
      {error ? (
        <p className="field__error" id={describedBy}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={describedBy}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

// Filter control with a visible label above it (placeholders alone disappear once you type).
export function ToolbarField({ label, children }) {
  return (
    <div className="toolbar__field">
      <span className="toolbar__label" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  )
}

export function FormActions({ children }) {
  return <div className="form-actions">{children}</div>
}

// `columns`: [{ key, header, width?, render? }]
export function DataTable({ columns, rows, rowKey = 'id', caption, empty = 'Nothing to show yet.' }) {
  return (
    <div className="data-table__scroll">
      <table className="data-table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatCard({ label, value, linkTo, linkLabel }) {
  return (
    <article className="stat-card">
      <h2 className="stat-card__label">{label}</h2>
      <p className="stat-card__value">{value}</p>
      <Link to={linkTo} className="stat-card__link">
        {linkLabel} →
      </Link>
    </article>
  )
}

export function ReportCard({ label, description, linkTo }) {
  return (
    <article className="report-card">
      <h3 className="report-card__label">{label}</h3>
      <p className="report-card__description">{description}</p>
      <Link to={linkTo} className="report-card__link">
        View Report →
      </Link>
    </article>
  )
}
