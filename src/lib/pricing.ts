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
