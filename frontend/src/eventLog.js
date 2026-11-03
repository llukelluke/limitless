// Event log images are JSON text; these read them and find what changed.
import { formatMoney } from './constants.js'

export const ACTIONS = { ADD: 'Added', MODIFY: 'Modified', DEACTIVATE: 'Deactivated' }

export function parseImage(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

const MONEY_FIELDS = ['initial_balance', 'debit', 'credit', 'balance']

export const show = (value, field) => {
  if (value === null || value === undefined || value === '') return '—'
  return MONEY_FIELDS.includes(field) ? formatMoney(value) : String(value)
}

// Fields whose value differs between the before and after images (none for an ADD).
export function changedFields(event) {
  const before = parseImage(event.before_image)
  const after = parseImage(event.after_image)
  const fields = Object.keys(after ?? before ?? {})
  return fields.filter((field) => before && after && show(before[field], field) !== show(after[field], field))
}
