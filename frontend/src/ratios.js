// Ratio dashboard helpers: number formatting, gauge chart geometry, and each user's saved dashboard choices.

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

// Gauge chart scale: 0 to a little past the thresholds, the red / yellow / green stops as fractions of it
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

// selected: ratio keys to show (null = default: every ratio that has a value). charts: show the gauge charts.
export function loadPrefs(user) {
  try {
    return { selected: null, charts: true, ...JSON.parse(localStorage.getItem(prefsKey(user))) }
  } catch {
    return { selected: null, charts: true }
  }
}

export function savePrefs(user, prefs) {
  localStorage.setItem(prefsKey(user), JSON.stringify(prefs))
}

export function visibleRatios(ratios, selected) {
  return ratios.filter((r) => (selected ? selected.includes(r.key) : r.value != null))
}
