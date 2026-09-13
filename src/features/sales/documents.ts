import { AppError } from '../../lib/errors'
import type { BusinessDocument, Currency, DocumentInput, PriceTier, Product } from '../../lib/domain'
export const tierLabels: Record<PriceTier,string> = { emprendedor: 'Emprendedor', vip: 'VIP', premium: 'Premium' }
export const documentLabels = { invoice: 'Factura', proforma: 'Proforma / Cotización' }
export function priceFor(product: Product, tier: PriceTier, currency: Currency): number | null {
  return product.prices?.find(p => p.tier === tier && p.currency === currency)?.amount
    ?? (tier === 'emprendedor' && product.currency === currency ? product.price : null)
}
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/[\s()+-]/g, '')
  if (/^[2-8]\d{7}$/.test(digits)) digits = '505' + digits
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new AppError('validation','Ingresa un teléfono válido con código de país, por ejemplo +505 8888 0000.')
  return digits
}
export function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Managua', year:'numeric', month:'2-digit', day:'2-digit' }).format(date)
}
export function validateDocument(input: DocumentInput) {
  if (!input.customerId && !input.customerName.trim()) throw new AppError('validation','Ingresa el nombre del cliente.')
  if (!input.items.length || input.items.length > 100) throw new AppError('validation','Agrega entre 1 y 100 productos.')
  if (new Set(input.items.map(i => i.productId)).size !== input.items.length) throw new AppError('validation','No repitas productos.')
  if (input.items.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10000)) throw new AppError('validation','Usa cantidades enteras entre 1 y 10000.')
  if (input.kind === 'proforma' && (!input.validUntil || input.validUntil < localDate())) throw new AppError('validation','Revisa la vigencia de la proforma.')
  if (input.customerPhone) normalizePhone(input.customerPhone)
}
function money(value: number, currency: Currency) { return `${currency} ${value.toFixed(2)}` }
export function documentText(doc: BusinessDocument): string {
  const title = doc.kind === 'proforma' ? 'PROFORMA / COTIZACIÓN' : 'FACTURA'
  return [
    ...(doc.demo ? ['DEMOSTRACIÓN — SIN VALIDEZ COMERCIAL'] : []),
    `${title} ${doc.number}`, doc.issuer.name, doc.issuer.address, doc.issuer.phone,
    `Cliente: ${doc.customerName}`, `Fecha: ${localDate(new Date(doc.createdAt))}`,
    `Lista: ${tierLabels[doc.tier]}`,
    ...doc.items.map(i => `${i.quantity} × ${i.description}\n${money(i.unitPrice,doc.currency)} c/u · ${money(i.lineTotal,doc.currency)}`),
    `TOTAL: ${money(doc.total,doc.currency)}`,
    ...(doc.kind === 'proforma' ? [`Válida hasta: ${doc.validUntil}`, 'Esta cotización no es una factura ni un comprobante de pago. Sujeta a disponibilidad.']
      : [doc.paymentMethod === 'pending' ? 'Pago pendiente.' : `Forma de pago registrada: ${doc.paymentMethod === 'cash' ? 'Efectivo' : doc.paymentMethod === 'card_pos' ? 'POS / Tarjeta' : 'Transferencia bancaria'}.`]),
    ...(doc.notes ? [`Observaciones: ${doc.notes}`] : []),
  ].filter(Boolean).join('\n\n')
}
export function whatsappUrl(doc: BusinessDocument, phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(documentText(doc))}`
}
