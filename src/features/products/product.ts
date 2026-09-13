import { z } from 'zod'
import type { Product } from '../../lib/domain'
const money = z
  .number()
  .finite()
  .positive()
  .max(10000000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    'Usa hasta dos decimales.',
  )
const pair = z.object({ NIO: money, USD: money })
export const productInputSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().min(0),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().min(1).max(100),
  category: z.enum(['arabian', 'designer', 'niche', 'unspecified']),
  gender: z.enum(['male', 'female', 'unisex', 'unspecified']),
  size: z.number().finite().positive().max(99999).nullable(),
  unit: z.enum(['oz', 'ml']),
  manufacturerBarcode: z.string().regex(/^(?:[0-9]{8}|[0-9]{12,14})?$/),
  minimumStock: z.number().int().min(0).max(1000000),
  active: z.boolean(),
  imagePath: z.string().max(250).nullable(),
  prices: z.object({ emprendedor: pair, vip: pair, premium: pair }),
})
export type ProductInput = z.infer<typeof productInputSchema>
export function productInput(product?: Product): ProductInput {
  return {
    id: product?.id ?? crypto.randomUUID(),
    revision: product?.revision ?? 0,
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? 'unspecified',
    gender: product?.gender ?? 'unspecified',
    size: product?.size ?? null,
    unit: product?.unit ?? 'oz',
    manufacturerBarcode: product?.manufacturerBarcode ?? '',
    minimumStock: product?.minimumStock ?? 0,
    active: product?.active ?? true,
    imagePath: product?.imagePath ?? null,
    prices: structuredClone(
      product?.prices ?? {
        emprendedor: { NIO: 0, USD: 0 },
        vip: { NIO: 0, USD: 0 },
        premium: { NIO: 0, USD: 0 },
      },
    ),
  }
}
export async function optimizeProductImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Elige una imagen JPG, PNG o WebP.')
  if (file.size > 10 * 1024 * 1024)
    throw new Error('La imagen debe pesar menos de 10 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No pudimos preparar la imagen.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    )
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error(
        'La imagen es demasiado grande. Elige una de menor tamaño.',
      )
    return blob
  } finally {
    bitmap.close()
  }
}
