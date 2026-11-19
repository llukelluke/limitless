import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Select } from './AdminUI.jsx'
import { CHART_TYPES, formatRatio } from '../ratios.js'

const money = (n) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n))
const STATUS = { GOOD: 'Good', WARNING: 'Borderline', BAD: 'Needs a closer look', NONE: 'Not enough data' }

// The three ranges behind the card's color, in the ratio's own unit
function ranges(ratio) {
  const f = (value) => formatRatio({ value, unit: ratio.unit })
  return ratio.higherIsBetter
    ? [['Good', `${f(ratio.good)} or higher`], ['Borderline', `${f(ratio.warn)} to ${f(ratio.good)}`], ['Needs a closer look', `below ${f(ratio.warn)}`]]
    : [['Good', `${f(ratio.good)} or lower`], ['Borderline', `${f(ratio.good)} to ${f(ratio.warn)}`], ['Needs a closer look', `above ${f(ratio.warn)}`]]
}

// Pop-up shown when a ratio card is clicked: the value, how it is worked out from the books, the ranges behind
// its color, and its layout (chart type, position) for people who can't or don't want to drag.
export default function RatioSummary({ ratio, chartType, canMoveEarlier, canMoveLater, onChange, onMove, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ratio && !ref.current.open) ref.current.showModal()
    if (!ratio && ref.current.open) ref.current.close()
  }, [ratio])

  return (
    <dialog
      ref={ref}
      className="help-dialog ratio-summary"
      aria-label={ratio ? `${ratio.name} summary` : 'Ratio summary'}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself) closes it
      onClick={(event) => event.target === ref.current && ref.current.close()}
    >
      {ratio && (
        <>
          <div className="help-dialog__head">
            <h2 className="panel__title">{ratio.name}</h2>
            <button type="button" className="text-link text-link--strong" title="Close the summary" onClick={() => ref.current.close()}>
              <X size={16} aria-hidden="true" />
              Close
            </button>
          </div>
          <div className="ratio-summary__body">
            <p className="ratio-summary__value">
              {formatRatio(ratio)} <span className={`ratio-summary__status ratio-summary__status--${ratio.status.toLowerCase()}`}>{STATUS[ratio.status]}</span>
            </p>
            <p className="ratio-summary__formula">
              <strong>Formula:</strong> {ratio.formula}
            </p>
            {ratio.note && <p className="ratio-summary__note">{ratio.note}</p>}

            {Object.keys(ratio.parts ?? {}).length > 0 && (
              <>
                <h3 className="ratio-summary__heading">How it is worked out</h3>
                <table className="data-table ratio-summary__table">
                  <tbody>
                    {Object.entries(ratio.parts).map(([label, amount]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>
                          <span className="num">{money(amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{ratio.name}</td>
                      <td>
                        <span className="num">{formatRatio(ratio)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="ratio-summary__hint">As of today, from approved journal entries. Income and expense amounts cover everything to date.</p>
              </>
            )}

            {ratio.goodRange && (
              <>
                <h3 className="ratio-summary__heading">What the colors mean</h3>
                <ul className="ratio-summary__ranges">
                  {ranges(ratio).map(([label, range]) => (
                    <li key={label}>
                      <span className={`ratio-summary__dot ratio-summary__dot--${label === 'Good' ? 'good' : label === 'Borderline' ? 'warning' : 'bad'}`} aria-hidden="true" />
                      <strong>{label}:</strong> {range}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="ratio-summary__heading">Layout</h3>
            <div className="ratio-summary__layout">
              <label className="ratio-option">
                Chart
                <Select wrapClassName="select--inline" className="toolbar__filter" title="Chart type for this ratio" options={CHART_TYPES} value={chartType} onChange={(event) => onChange(event.target.value)} />
              </label>
              <button type="button" className="btn btn--secondary btn--sm" title="Move this card one place earlier in its category" disabled={!canMoveEarlier} onClick={() => onMove(-1)}>
                Move earlier
              </button>
              <button type="button" className="btn btn--secondary btn--sm" title="Move this card one place later in its category" disabled={!canMoveLater} onClick={() => onMove(1)}>
                Move later
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  )
}
