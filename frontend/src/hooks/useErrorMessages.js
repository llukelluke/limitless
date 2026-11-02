import { api } from '../api/client.js'
import { ERROR_FALLBACKS } from '../journal.js'
import useApi from './useApi.js'

// Error text comes from the error_messages table; returns code → message.
export default function useErrorMessages() {
  const { data } = useApi(api.errorMessages)
  return (code) => data?.find((m) => m.error_code === code)?.message ?? ERROR_FALLBACKS[code] ?? code
}
