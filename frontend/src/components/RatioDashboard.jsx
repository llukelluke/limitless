import { Suspense, lazy, useEffect, useEffectEvent, useRef, useState } from 'react'
import { GripVertical, MoveDiagonal2 } from 'lucide-react'
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
  clampSize,
  formatRatio,
  loadPrefs,
  moveKey,
  normalizePrefs,
  orderRatios,
  savePrefs,
  sizeFor,
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

function RatioCard({ ratio, chart, size, dragging, onOpen, onHold, onResize }) {
  const status = STATUS[ratio.status] ?? STATUS.NONE
  return (
    <article
      className={`ratio-card ${status.className} ${dragging ? 'ratio-card--dragging' : ''}`}
      style={{ '--w': size.w, '--h': size.h }}
      data-ratio-key={ratio.key}
      data-w={size.w}
      data-h={size.h}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      title={`${ratio.formula}. Click for a summary; press and hold to drag it to a new place.`}
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
      <span className="ratio-card__resize" title="Drag to resize this card" aria-hidden="true" onPointerDown={onResize} onClick={(event) => event.stopPropagation()}>
        <MoveDiagonal2 size={14} />
      </span>
    </article>
  )
}

// Financial ratios as of today, color coded, on every role's landing page. The Customize tab picks which ratios
// show and each one's chart type. On the dashboard each card opens a summary when clicked, can be dragged to a new
// place in its category (press and hold, then slide), and resized from its corner. Choices are saved for this user.
export default function RatioDashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useApi(api.financialRatios)
  const [tab, setTab] = useState('dashboard')
  const [prefs, setPrefs] = useState(() => loadPrefs(user))
  const [openKey, setOpenKey] = useState(null)
  const [draggingKey, setDraggingKey] = useState(null)
  const gesture = useRef(null) // the press, drag or resize in progress
  const justDragged = useRef(false)
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
  const setSize = (key, size) => update({ ...prefs, sizes: { ...prefs.sizes, [key]: clampSize(size) } })
  // The next or previous shown card in the same category
  const neighbor = (key, step) => {
    const ratio = ratios.find((r) => r.key === key)
    const group = shown.filter((r) => r.category === ratio.category)
    return group[group.findIndex((r) => r.key === key) + step]?.key
  }

  // ---------- press and hold to drag; drag the corner to resize ----------
  const finishGesture = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    clearTimeout(g.timer)
    if (!g.active) return
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
    if (g.kind === 'resize') {
      g.active = true
      const size = clampSize({ w: (g.width + dx + g.gap) / g.unitW, h: (g.height + dy + g.gap) / g.unitH })
      setPrefs((current) => ({ ...current, sizes: { ...current.sizes, [g.key]: size } }))
      return
    }
    if (!g.active) {
      if (Math.hypot(dx, dy) > SLOP) finishGesture() // moved before the hold finished: a scroll or a click
      return
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-ratio-key]')
    const targetKey = target?.dataset.ratioKey
    if (!targetKey || targetKey === g.key || target.closest('.ratio-cards') !== g.grid) return
    setPrefs((current) => ({ ...current, order: moveKey(orderRatios(data ?? [], current.order).map((r) => r.key), g.key, targetKey) }))
  })
  const onPointerEnd = useEffectEvent(finishGesture)
  useEffect(() => {
    // During a touch drag, stop the page scrolling under the finger. Chrome decides at touchstart whether a touch
    // may scroll, so this listener has to be there before the touch begins, not added once the drag starts.
    const stopScroll = (event) => gesture.current?.active && gesture.current.kind === 'drag' && event.preventDefault()
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
    const timer = setTimeout(() => {
      if (gesture.current?.key !== key) return
      gesture.current.active = true
      setDraggingKey(key)
    }, HOLD_MS)
    gesture.current = { kind: 'drag', key, x: event.clientX, y: event.clientY, grid: event.currentTarget.closest('.ratio-cards'), timer }
  }

  const dragToResize = (key) => (event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const card = event.currentTarget.closest('.ratio-card').getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(event.currentTarget.closest('.ratio-cards')).columnGap) || 0
    const size = sizeFor(prefs, key)
    gesture.current = {
      kind: 'resize',
      key,
      x: event.clientX,
      y: event.clientY,
      width: card.width,
      height: card.height,
      gap,
      unitW: (card.width + gap) / size.w,
      unitH: (card.height + gap) / size.h,
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
            {shown.length > 0 && (
              <p className="ratio-hint">Click a ratio for its summary. Press and hold a card to drag it to a new place; drag its corner to resize it.</p>
            )}
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
                        size={sizeFor(prefs, ratio.key)}
                        dragging={draggingKey === ratio.key}
                        onOpen={open(ratio.key)}
                        onHold={holdToDrag(ratio.key)}
                        onResize={dragToResize(ratio.key)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
            <RatioSummary
              ratio={openRatio}
              chartType={openRatio ? chartTypeFor(prefs, openRatio.key) : 'gauge'}
              size={openRatio ? sizeFor(prefs, openRatio.key) : { w: 1, h: 1 }}
              canMoveEarlier={Boolean(openRatio && neighbor(openRatio.key, -1))}
              canMoveLater={Boolean(openRatio && neighbor(openRatio.key, 1))}
              onChange={({ type, size }) => (type ? setType(openKey, type) : setSize(openKey, size))}
              onMove={(step) => update({ ...prefs, order: moveKey(allKeys, openKey, neighbor(openKey, step)) })}
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
                title="Show the ratios that have data, as gauges, in the standard order and size"
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
