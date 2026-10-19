import { useEffect, useRef, useState } from 'react'
import { formatDate, todayIso } from '../constants.js'
import './Calendar.css'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December']

// Today's date button in the top left corner; opens a month calendar.
export default function Calendar() {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState({ year: today.getFullYear(), index: today.getMonth() })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const shift = (delta) =>
    setMonth(({ year, index }) => {
      const date = new Date(year, index + delta, 1)
      return { year: date.getFullYear(), index: date.getMonth() }
    })

  const leadingBlanks = new Date(month.year, month.index, 1).getDay()
  const daysInMonth = new Date(month.year, month.index + 1, 0).getDate()
  const isToday = (day) =>
    day === today.getDate() && month.index === today.getMonth() && month.year === today.getFullYear()

  return (
    <div className="calendar" ref={ref}>
      <button
        type="button"
        className="calendar__trigger"
        title="Open calendar"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" />
          <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" />
        </svg>
        {formatDate(todayIso())}
      </button>
      {open && (
        <div className="calendar__popup" role="dialog" aria-label="Calendar">
          <div className="calendar__head">
            <button type="button" className="calendar__nav" title="Previous month" onClick={() => shift(-1)}>
              ‹
            </button>
            <span className="calendar__month">
              {MONTH_NAMES[month.index]} {month.year}
            </span>
            <button type="button" className="calendar__nav" title="Next month" onClick={() => shift(1)}>
              ›
            </button>
          </div>
          <div className="calendar__grid">
            {WEEKDAYS.map((day) => (
              <span key={day} className="calendar__weekday">
                {day}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => (
              <span key={i} className={`calendar__day ${isToday(i + 1) ? 'calendar__day--today' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="text-link calendar__today"
            title="Jump back to the current month"
            onClick={() => setMonth({ year: today.getFullYear(), index: today.getMonth() })}
          >
            Today
          </button>
        </div>
      )}
    </div>
  )
}
