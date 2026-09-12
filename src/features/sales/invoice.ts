import { z } from 'zod'
import { lineCents } from '../../lib/pricing'
import type { Currency, PriceTier } from '../../lib/domain'
const money = z.number().finite().min(0).max(10000000)
const pair = z.object({ NIO: money, USD: money })
export const invoiceSchema = z.object({
  id: z.string(),
  reference: z.string(),
  customer: z.string().max(200),
  taxId: z.string().max(100),
  currency: z.enum(['NIO', 'USD']),
  tier: z.enum(['emprendedor', 'vip', 'premium']),
  payment: z.enum(['cash', 'card_pos', 'bank_transfer']),
  notes: z.string().max(1500),
  createdAt: z.string(),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        barcode: z.string(),
        size: z.string(),
        quantity: z.number().int().min(1).max(9999),
        prices: z.object({ emprendedor: pair, vip: pair, premium: pair }),
      }),
    )
    .min(1),
})
export type InvoiceDraft = z.infer<typeof invoiceSchema>
export type InvoiceLine = InvoiceDraft['lines'][number]
export function invoiceTotal(
  lines: InvoiceLine[],
  tier: PriceTier,
  currency: Currency,
) {
  const total = lines.reduce(
    (sum, line) => sum + lineCents(line.prices[tier][currency], line.quantity),
    0,
  )
  if (!Number.isSafeInteger(total))
    throw new Error('El importe es demasiado grande.')
  return total / 100
}
