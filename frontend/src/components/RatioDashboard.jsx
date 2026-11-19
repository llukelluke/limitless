import { Suspense, lazy, useState } from 'react'
import { api } from '../api/client.js'
import AsyncContent from './AsyncContent.jsx'
import { Panel } from './AdminUI.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import useApi from '../hooks/useApi.js'
import { RATIO_CATEGORIES, formatRatio, loadPrefs, savePrefs, visibleRatios } from '../ratios.js'

// ECharts is big: load it in its own chunk, only when a gauge is shown.
const RatioGauge = lazy(() => import('./RatioGauge.jsx'))

const STATUS = {
  GOOD: { label: 'Good', className: 'ratio-card--good' },
  WARNING: { label: 'Borderline', className: 'ratio-card--warning' },
  BAD: { label: 'Needs a closer look', className: 'ratio-card--bad' },
  NONE: { label: 'Not enough data', className: '' },
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customize', label: 'Customize' },
]

function RatioCard({ ratio, charts }) {
  const status = STATUS[ratio.status] ?? STATUS.NONE
  return (
    <article className={`ratio-card ${status.className}`} title={ratio.formula}>
      <h4 className="ratio-card__name">{ratio.name}</h4>
      <p className="ratio-card__value">{formatRatio(ratio)}</p>
      {charts && ratio.value != null && (
        <Suspense fallback={<div className="ratio-gauge" />}>
          <RatioGauge ratio={ratio} />
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
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`ratio-tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`ratio-tabpanel-${id}`}
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
                      <RatioCard key={ratio.key} ratio={ratio} charts={prefs.charts} />
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
                <input type="checkbox" checked={prefs.charts} onChange={() => update({ ...prefs, charts: !prefs.charts })} />
                Show gauge charts
              </label>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ ...prefs, selected: ratios.map((r) => r.key) })}>
                Show all
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ ...prefs, selected: [] })}>
                Hide all
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ selected: null, charts: true })}>
                Reset to default
              </button>
            </div>
            {RATIO_CATEGORIES.map((category) => (
              <fieldset key={category} className="ratio-customize__group">
                <legend className="ratio-group__title">{category} ratios</legend>
                {ratios
                  .filter((r) => r.category === category)
                  .map((r) => (
                    <label key={r.key} className="ratio-option" title={r.formula}>
                      <input type="checkbox" checked={shownKeys.includes(r.key)} onChange={() => toggle(r.key)} />
                      {r.name}
                      {r.value == null && <span className="ratio-option__note"> (no data)</span>}
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
        )}
      </AsyncContent>
    </Panel>
  )
}
