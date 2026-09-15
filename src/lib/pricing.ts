import type { Currency, PriceTier, Product } from './domain'
export const priceTierLabels: Record<PriceTier, string> = {
  emprendedor: 'Emprendedor',
  vip: 'VIP',
  premium: 'Premium',
}
export function productPrice(
  product: Product,
  tier: PriceTier,
  currency: Currency,
): number | null {
  return (
    product.prices?.[tier]?.[currency] ??
    (product.currency === currency ? product.price : null)
  )
}
/**
 * El equivalente del mismo importe en la otra moneda. El catálogo se cotiza en
 * dólares y el precio en córdobas sale de la tasa vigente, así que convertir un
 * total con esa misma tasa devuelve el precio que el cliente pagaría si pidiera
 * cobrarse en la otra moneda —no una cifra aproximada—. Devuelve `null` cuando
 * no hay tasa: es preferible no enseñar nada a enseñar una conversión inventada.
 */
export function equivalentAmount(
  total: number,
  currency: Currency,
  rate: number | null | undefined,
): { currency: Currency; amount: number } | null {
  if (
    rate == null ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isFinite(total)
  )
    return null
  const value = currency === 'NIO' ? total / rate : total * rate
  if (!Number.isFinite(value)) return null
  return {
    currency: currency === 'NIO' ? 'USD' : 'NIO',
    amount: Math.round(value * 100) / 100,
  }
}
/**
 * Lo que queda de un precio después del costo, entre 0 y 1. Nulo si falta
 * cualquiera de los dos: un margen a medias es peor que no enseñar ninguno.
 */
export function marginRate(
  priceNio: number | null,
  costNio: number | null | undefined,
) {
  if (priceNio === null || priceNio <= 0) return null
  if (costNio === null || costNio === undefined) return null
  if (!Number.isFinite(costNio) || costNio < 0) return null
  return (priceNio - costNio) / priceNio
}
export function lineCents(price: number, quantity: number) {
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  )
    throw new Error('Revisa el precio y la cantidad.')
  const cents = Math.round(price * 100) * quantity
  if (!Number.isSafeInteger(cents))
    throw new Error('El importe es demasiado grande.')
  return cents
}
