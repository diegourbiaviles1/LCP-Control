import type { Currency } from './domain'
export function formatCurrency(value: number, currency: Currency) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(value)
}
export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('es-NI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Managua',
  }).format(new Date(value))
}
