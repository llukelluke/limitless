import { Suspense, lazy, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { api } from '../api/client.js'
import AsyncContent from './AsyncContent.jsx'
import { Panel, Select } from './AdminUI.jsx'
import RatioSummary from './RatioSummary.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import useApi from '../hooks/useApi.js'
import {
  CHART_TYPES,
  RATIO_CATEGORIES,
  chartTypeFor,
  formatRatio,
  loadPrefs,
  moveKey,
  normalizePrefs,
  orderRatios,
  savePrefs,
  visibleRatios,
} from '../ratios.js'

// ECharts is big: load it in its own chunk, only when a chart is shown.
const RatioChart = lazy(() => import('./RatioChart.jsx'))

const STATUS = {
  GOOD: { label: 'Good', className: 'ratio-card--good' },
  WARNING: { label: 'Borderline', className: 'ratio-card--warning' },
  BAD: { label: 'Needs a closer look', className: 'ratio-card--bad' },
  NONE: { label: 'Not enough data', className: '' },
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', title: 'Show the ratio dashboard' },
  { id: 'customize', label: 'Customize', title: 'Choose which ratios and charts to show' },
]

const HOLD_MS = 300 // press and hold this long before a card can be dragged
const SLOP = 8 // moving further than this first means scrolling or clicking, not dragging
const LIFT = 'scale(1.04)'
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const cardsIn = (grid) => [...grid.querySelectorAll('[data-ratio-key]')]
// A card's place in the grid, ignoring any transform on it (the grid is the cards' offset parent)
function slotOf(card) {
  const grid = card.offsetParent.getBoundingClientRect()
  return { left: grid.left + card.offsetLeft, top: grid.top + card.offsetTop, width: card.offsetWidth, height: card.offsetHeight }
}
const inside = (slot, x, y) => x >= slot.left && x <= slot.left + slot.width && y >= slot.top && y <= slot.top + slot.height

function RatioCard({ ratio, chart, dragging, onOpen, onHold }) {
  const status = STATUS[ratio.status] ?? STATUS.NONE
  return (
    <article
      className={`ratio-card ${status.className} ${dragging ? 'ratio-card--dragging' : ''}`}
      data-ratio-key={ratio.key}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      title={`${ratio.formula}. Click for a summary.`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
      onPointerDown={onHold}
      onContextMenu={(event) => event.pointerType !== 'mouse' && event.preventDefault()}
    >
      <GripVertical className="ratio-card__grip" size={16} aria-hidden="true" />
      <h4 className="ratio-card__name">{ratio.name}</h4>
      <p className="ratio-card__value">{formatRatio(ratio)}</p>
      {chart !== 'none' && ratio.value != null && (
        <Suspense fallback={<div className="ratio-chart" />}>
          <RatioChart ratio={ratio} type={chart} />
        </Suspense>
      )}
      <p className="ratio-card__status">{status.label}</p>
      <p className="ratio-card__range">{ratio.note ?? `Good: ${ratio.goodRange}`}</p>
    </article>
  )
}

// Financial ratios as of today, color coded, on every role's landing page. The Customize tab picks which ratios
// show and each one's chart type. On the dashboard each card opens a summary when clicked and can be dragged to a
// new place in its category (press and hold, then slide). Choices are saved for this user. How-to: Help panel.
export default function RatioDashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useApi(api.financialRatios)
  const [tab, setTab] = useState('dashboard')
  const [prefs, setPrefs] = useState(() => loadPrefs(user))
  const [openKey, setOpenKey] = useState(null)
  const [draggingKey, setDraggingKey] = useState(null)
  const gesture = useRef(null) // the press or drag in progress
  const justDragged = useRef(false)
  const before = useRef(null) // where each card was drawn just before a reorder, for the slide animation
  const ratios = orderRatios(data ?? [], prefs.order)
  const shown = visibleRatios(ratios, prefs.selected)
  const shownKeys = shown.map((r) => r.key)
  const allKeys = ratios.map((r) => r.key)

  const update = (next) => {
    setPrefs(next)
    savePrefs(user, next)
  }
  const toggle = (key) =>
    update({ ...prefs, selected: shownKeys.includes(key) ? shownKeys.filter((k) => k !== key) : [...shownKeys, key] })
  const setType = (key, type) => update({ ...prefs, types: { ...prefs.types, [key]: type } })
  // The next or previous shown card in the same category
  const neighbor = (key, step) => {
    const ratio = ratios.find((r) => r.key === key)
    const group = shown.filter((r) => r.category === ratio.category)
    return group[group.findIndex((r) => r.key === key) + step]?.key
  }

  // ---------- press and hold to drag ----------
  // The dragged card follows the pointer: its slot plus the offset it was grabbed at.
  const follow = (g) => {
    const card = g.grid.querySelector(`[data-ratio-key="${g.key}"]`)
    if (!card) return
    const slot = slotOf(card)
    card.style.transform = `translate(${g.lastX - g.grabX - slot.left}px, ${g.lastY - g.grabY - slot.top}px) ${LIFT}`
  }
  // Remember where every card in the grid is drawn now, so the next render can slide them from there.
  const capture = (grid, moving) => {
    before.current = { grid, moving, rects: new Map(cardsIn(grid).map((card) => [card.dataset.ratioKey, card.getBoundingClientRect()])) }
  }
  // After a reorder: slide each other card from where it was to its new place (FLIP), and keep the
  // dragged card under the pointer in its new slot.
  useLayoutEffect(() => {
    const b = before.current
    if (!b) return
    before.current = null
    const g = gesture.current
    for (const card of cardsIn(b.grid)) {
      const key = card.dataset.ratioKey
      if (key === b.moving) {
        if (g?.key === key) follow(g)
        continue
      }
      const old = b.rects.get(key)
      const now = card.getBoundingClientRect()
      if (!old || reduceMotion() || (old.left === now.left && old.top === now.top)) continue
      card.getAnimations().forEach((animation) => animation.cancel())
      card.animate([{ transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` }, { transform: 'none' }], { duration: 220, easing: EASE })
    }
  })

  const finishGesture = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    clearTimeout(g.timer)
    if (!g.active) return
    // Settle the card into its slot
    const card = g.grid.querySelector(`[data-ratio-key="${g.key}"]`)
    if (card) {
      const from = card.style.transform
      card.style.transform = ''
      if (from && !reduceMotion()) card.animate([{ transform: from }, { transform: 'none' }], { duration: 200, easing: EASE })
    }
    justDragged.current = true // the click that follows a drag must not open the summary
    setTimeout(() => (justDragged.current = false), 0)
    setDraggingKey(null)
    setPrefs((current) => {
      savePrefs(user, current)
      return current
    })
  }
  const onPointerMove = useEffectEvent((event) => {
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (!g.active) {
      if (Math.hypot(dx, dy) > SLOP) finishGesture() // moved before the hold finished: a scroll or a click
      return
    }
    g.lastX = event.clientX
    g.lastY = event.clientY
    follow(g)
    // Swap places with the card whose slot the pointer is over (slots, not drawn positions, so cards that are
    // still sliding don't swap back and forth)
    const target = cardsIn(g.grid).find((card) => card.dataset.ratioKey !== g.key && inside(slotOf(card), event.clientX, event.clientY))
    if (!target) return
    capture(g.grid, g.key)
    setPrefs((current) => ({ ...current, order: moveKey(orderRatios(data ?? [], current.order).map((r) => r.key), g.key, target.dataset.ratioKey) }))
  })
  const onPointerEnd = useEffectEvent(finishGesture)
  useEffect(() => {
    // During a touch drag, stop the page scrolling under the finger. Chrome decides at touchstart whether a touch
    // may scroll, so this listener has to be there before the touch begins, not added once the drag starts.
    const stopScroll = (event) => gesture.current?.active && event.preventDefault()
    document.addEventListener('touchmove', stopScroll, { passive: false })
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    return () => {
      document.removeEventListener('touchmove', stopScroll)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
    }
  }, [])

  const holdToDrag = (key) => (event) => {
    if (event.button !== 0 || gesture.current) return
    const card = event.currentTarget
    const slot = slotOf(card)
    const timer = setTimeout(() => {
      const g = gesture.current
      if (g?.key !== key) return
      g.active = true
      setDraggingKey(key)
      // Lift the card up, then let it follow the pointer
      card.style.transform = `translate(0px, 0px) ${LIFT}`
      if (!reduceMotion()) card.animate([{ transform: 'none' }, { transform: card.style.transform }], { duration: 150, easing: EASE })
    }, HOLD_MS)
    gesture.current = {
      key,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      grabX: event.clientX - slot.left,
      grabY: event.clientY - slot.top,
      grid: card.closest('.ratio-cards'),
      timer,
    }
  }

  const open = (key) => () => !justDragged.current && setOpenKey(key)
  const openRatio = ratios.find((r) => r.key === openKey)

  const tabs = (
    <div className="ratio-tabs" role="tablist" aria-label="Financial ratios">
      {TABS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`ratio-tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`ratio-tabpanel-${id}`}
          title={title}
          className={`ratio-tab ${tab === id ? 'ratio-tab--active' : ''}`}
          onClick={() => setTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <Panel title="Financial ratios" action={tabs} className="ratio-panel">
      <AsyncContent loading={loading} error={error}>
        {tab === 'dashboard' ? (
          <div role="tabpanel" id="ratio-tabpanel-dashboard" aria-labelledby="ratio-tab-dashboard">
            {shown.length === 0 && <p className="home-note">No ratios selected. Open Customize to pick some.</p>}
            {RATIO_CATEGORIES.map((category) => {
              const group = shown.filter((r) => r.category === category)
              if (group.length === 0) return null
              return (
                <section key={category} className="ratio-group">
                  <h3 className="ratio-group__title">{category} ratios</h3>
                  <div className="ratio-cards">
                    {group.map((ratio) => (
                      <RatioCard
                        key={ratio.key}
                        ratio={ratio}
                        chart={chartTypeFor(prefs, ratio.key)}
                        dragging={draggingKey === ratio.key}
                        onOpen={open(ratio.key)}
                        onHold={holdToDrag(ratio.key)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
            <RatioSummary
              ratio={openRatio}
              chartType={openRatio ? chartTypeFor(prefs, openRatio.key) : 'gauge'}
              canMoveEarlier={Boolean(openRatio && neighbor(openRatio.key, -1))}
              canMoveLater={Boolean(openRatio && neighbor(openRatio.key, 1))}
              onChange={(type) => setType(openKey, type)}
              onMove={(step) => {
                const grid = document.querySelector(`[data-ratio-key="${openKey}"]`)?.closest('.ratio-cards')
                if (grid) capture(grid, null)
                update({ ...prefs, order: moveKey(allKeys, openKey, neighbor(openKey, step)) })
              }}
              onClose={() => setOpenKey(null)}
            />
          </div>
        ) : (
          <div role="tabpanel" id="ratio-tabpanel-customize" aria-labelledby="ratio-tab-customize">
            <div className="ratio-customize__actions">
              <label className="ratio-option">
                Chart type for all
                <Select
                  wrapClassName="select--inline"
                  className="toolbar__filter"
                  title="Set every ratio to this chart type"
                  options={CHART_TYPES}
                  value={prefs.chart}
                  onChange={(event) => update({ ...prefs, chart: event.target.value, types: {} })}
                />
              </label>
              <button type="button" className="btn btn--secondary btn--sm" title="Show every ratio" onClick={() => update({ ...prefs, selected: allKeys })}>
                Show all
              </button>
              <button type="button" className="btn btn--secondary btn--sm" title="Hide every ratio" onClick={() => update({ ...prefs, selected: [] })}>
                Hide all
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                title="Show the ratios that have data, as gauges, in the standard order"
                onClick={() => update(normalizePrefs(null))}
              >
                Reset to default
              </button>
            </div>
            {/* One dropdown per category, closed until opened, so the page isn't a wall of checkboxes */}
            {RATIO_CATEGORIES.map((category) => {
              const group = ratios.filter((r) => r.category === category)
              const on = group.filter((r) => shownKeys.includes(r.key)).length
              return (
                <details key={category} className="ratio-dropdown">
                  <summary className="ratio-dropdown__summary" title={`Choose which ${category.toLowerCase()} ratios to show, and how`}>
                    <span className="ratio-dropdown__title">{category} ratios</span>
                    <span className="ratio-dropdown__count">
                      {on} of {group.length} shown
                    </span>
                  </summary>
                  <div className="ratio-dropdown__menu">
                    {group.map((r) => (
                      <div key={r.key} className="ratio-choice">
                        <label className="ratio-option" title={r.formula}>
                          <input type="checkbox" title={`Show or hide ${r.name}`} checked={shownKeys.includes(r.key)} onChange={() => toggle(r.key)} />
                          {r.name}
                          {r.value == null && <span className="ratio-option__note"> (no data)</span>}
                        </label>
                        <Select
                          wrapClassName="select--inline"
                          className="toolbar__filter"
                          aria-label={`Chart type for ${r.name}`}
                          title={`Chart type for ${r.name}`}
                          options={CHART_TYPES}
                          value={chartTypeFor(prefs, r.key)}
                          onChange={(event) => setType(r.key, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </AsyncContent>
    </Panel>
  )
}
