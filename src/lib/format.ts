import type { Currency } from './domain'
export function formatCurrency(value: number, currency: Currency) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(value)
}
// Sólo fecha: «2026-09-20», sin hora ni zona.
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Un valor de sólo fecha se interpreta como medianoche UTC, que en Managua es
 * todavía el día anterior: sin anclarlo, una vigencia al 20 se imprimiría como
 * 19. Se fija al mediodía UTC, que cae en el mismo día en toda América y
 * mantiene la fecha estable aunque el equipo tenga otra zona horaria.
 */
export function formatDate(value: string | Date) {
  const date =
    typeof value === 'string' && DAY_ONLY.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value)
  return new Intl.DateTimeFormat('es-NI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Managua',
  }).format(date)
}
