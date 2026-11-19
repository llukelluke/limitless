import { Suspense, lazy, useState } from 'react'
import { api } from '../api/client.js'
import AsyncContent from './AsyncContent.jsx'
import { Panel, Select } from './AdminUI.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import useApi from '../hooks/useApi.js'
import { CHART_TYPES, RATIO_CATEGORIES, formatRatio, loadPrefs, savePrefs, visibleRatios } from '../ratios.js'

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

function RatioCard({ ratio, chart }) {
  const status = STATUS[ratio.status] ?? STATUS.NONE
  return (
    <article className={`ratio-card ${status.className}`} title={ratio.formula}>
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

// Financial ratios as of today, color coded, on every role's landing page. The Customize tab picks which
// ratios and charts show; the choice is saved for this user.
export default function RatioDashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useApi(api.financialRatios)
  const [tab, setTab] = useState('dashboard')
  const [prefs, setPrefs] = useState(() => loadPrefs(user))
  const ratios = data ?? []
  const shown = visibleRatios(ratios, prefs.selected)
  const shownKeys = shown.map((r) => r.key)

  const update = (next) => {
    setPrefs(next)
    savePrefs(user, next)
  }
  const toggle = (key) =>
    update({ ...prefs, selected: shownKeys.includes(key) ? shownKeys.filter((k) => k !== key) : [...shownKeys, key] })

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
                      <RatioCard key={ratio.key} ratio={ratio} chart={prefs.chart} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div role="tabpanel" id="ratio-tabpanel-customize" aria-labelledby="ratio-tab-customize">
            <div className="ratio-customize__actions">
              <label className="ratio-option">
                Chart type
                <Select
                  wrapClassName="select--inline"
                  className="toolbar__filter"
                  title="Choose how each ratio is charted"
                  options={CHART_TYPES}
                  value={prefs.chart}
                  onChange={(event) => update({ ...prefs, chart: event.target.value })}
                />
              </label>
              <button type="button" className="btn btn--secondary btn--sm" title="Show every ratio" onClick={() => update({ ...prefs, selected: ratios.map((r) => r.key) })}>
                Show all
              </button>
              <button type="button" className="btn btn--secondary btn--sm" title="Hide every ratio" onClick={() => update({ ...prefs, selected: [] })}>
                Hide all
              </button>
              <button type="button" className="btn btn--secondary btn--sm" title="Show the ratios that have data, as gauges" onClick={() => update({ selected: null, chart: 'gauge' })}>
                Reset to default
              </button>
            </div>
            {/* One dropdown per category, closed until opened, so the page isn't a wall of checkboxes */}
            {RATIO_CATEGORIES.map((category) => {
              const group = ratios.filter((r) => r.category === category)
              const on = group.filter((r) => shownKeys.includes(r.key)).length
              return (
                <details key={category} className="ratio-dropdown">
                  <summary className="ratio-dropdown__summary" title={`Choose which ${category.toLowerCase()} ratios to show`}>
                    <span className="ratio-dropdown__title">{category} ratios</span>
                    <span className="ratio-dropdown__count">
                      {on} of {group.length} shown
                    </span>
                  </summary>
                  <div className="ratio-dropdown__menu">
                    {group.map((r) => (
                      <label key={r.key} className="ratio-option" title={r.formula}>
                        <input type="checkbox" title={`Show or hide ${r.name}`} checked={shownKeys.includes(r.key)} onChange={() => toggle(r.key)} />
                        {r.name}
                        {r.value == null && <span className="ratio-option__note"> (no data)</span>}
                      </label>
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
