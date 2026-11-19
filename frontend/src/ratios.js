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

const DEFAULT_PREFS = { selected: null, chart: 'gauge', types: {}, order: [], sizes: {} }
const isChartType = (value) => CHART_TYPES.some((t) => t.value === value)

// selected: ratio keys to show (null = default: every ratio that has a value). chart: chart type for every ratio,
// types: per-ratio chart types that override it. order: ratio keys in the user's order. sizes: { key: { w, h } }.
// Choices saved before chart types existed had charts: true/false; they become gauge / none.
export function normalizePrefs(saved) {
  const { charts, ...rest } = saved ?? {}
  const prefs = { ...DEFAULT_PREFS, ...(charts === false ? { chart: 'none' } : {}), ...rest }
  if (!isChartType(prefs.chart)) prefs.chart = 'gauge'
  prefs.types = Object.fromEntries(Object.entries(prefs.types ?? {}).filter(([, t]) => isChartType(t)))
  return prefs
}

export const chartTypeFor = (prefs, key) => prefs.types[key] ?? prefs.chart

// Cards are 1–3 grid columns wide and 1–2 rows tall.
export const clampSize = ({ w = 1, h = 1 } = {}) => ({
  w: Math.min(Math.max(Math.round(w), 1), 3),
  h: Math.min(Math.max(Math.round(h), 1), 2),
})
export const sizeFor = (prefs, key) => clampSize(prefs.sizes[key])

// Ratios in the user's saved order; any not in it (new ratios) follow in the API's order.
export function orderRatios(ratios, order) {
  const rank = (r) => (order.includes(r.key) ? order.indexOf(r.key) : order.length + ratios.indexOf(r))
  return [...ratios].sort((a, b) => rank(a) - rank(b))
}

// Moves `key` to where `target` is in the list of keys (after it when moving forward, before it when moving back).
export function moveKey(keys, key, target) {
  const next = keys.filter((k) => k !== key)
  next.splice(keys.indexOf(target), 0, key)
  return next
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
