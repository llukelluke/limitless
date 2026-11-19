// Ratio dashboard helpers: number formatting, chart geometry, and each user's saved dashboard choices.

export const RATIO_CATEGORIES = ['Profitability', 'Liquidity', 'Leverage', 'Activity', 'Other']

export function formatRatio({ value, unit }) {
  if (value == null) return '—'
  const n = Number(value)
  if (unit === 'percent') return `${(n * 100).toFixed(1)}%`
  if (unit === 'days') return `${Math.round(n)} days`
  if (unit === 'dollars') return `$${n.toFixed(2)}`
  if (unit === 'times') return `${n.toFixed(2)}×`
  return n.toFixed(2)
}

// Chart scale (gauge, bar, ring): 0 to a little past the thresholds, the red / yellow / green stops as fractions of it
// (the shape ECharts' gauge axisLine color takes), and the value clamped onto the scale.
export function gauge({ value, higherIsBetter, good, warn }) {
  const max = Math.max(good, warn) * 1.5
  const tones = higherIsBetter ? ['bad', 'warning', 'good'] : ['good', 'warning', 'bad']
  return {
    max,
    stops: [
      [Math.min(good, warn) / max, tones[0]],
      [Math.max(good, warn) / max, tones[1]],
      [1, tones[2]],
    ],
    value: value == null ? null : Math.min(Math.max(Number(value), 0), max),
  }
}

// shortcut: choices live in this browser's localStorage, so they don't follow the user to another computer.
const prefsKey = (user) => `limitless.ratio-dashboard.${user?.id ?? user?.username}`

export const CHART_TYPES = [
  { value: 'gauge', label: 'Gauge' },
  { value: 'bar', label: 'Bar' },
  { value: 'ring', label: 'Ring' },
  { value: 'none', label: 'No chart' },
]

const DEFAULT_PREFS = { selected: null, chart: 'gauge' }

// selected: ratio keys to show (null = default: every ratio that has a value). chart: one of CHART_TYPES.
// Choices saved before chart types existed had charts: true/false; they become gauge / none.
export function normalizePrefs(saved) {
  const { charts, ...rest } = saved ?? {}
  const prefs = { ...DEFAULT_PREFS, ...(charts === false ? { chart: 'none' } : {}), ...rest }
  return CHART_TYPES.some((t) => t.value === prefs.chart) ? prefs : { ...prefs, chart: 'gauge' }
}

export function loadPrefs(user) {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(prefsKey(user))))
  } catch {
    return normalizePrefs(null)
  }
}

export function savePrefs(user, prefs) {
  localStorage.setItem(prefsKey(user), JSON.stringify(prefs))
}

export function visibleRatios(ratios, selected) {
  return ratios.filter((r) => (selected ? selected.includes(r.key) : r.value != null))
}
