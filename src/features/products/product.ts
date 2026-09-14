import { z } from 'zod'
import type { Product } from '../../lib/domain'
// Los mensajes se muestran junto al campo que los produce, así que se escriben
// para quien llena el formulario, no para quien lee el código.
const money = z
  .number({ error: 'Escribe el precio.' })
  .finite('Escribe el precio.')
  .positive('El precio debe ser mayor que cero.')
  .max(10000000, 'El precio es demasiado alto.')
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    'Usa hasta dos decimales.',
  )
/**
 * El dólar es el precio que se decide; el córdoba sale de multiplicarlo por la
 * tasa vigente y nadie lo teclea. Se valida igual —viaja en el payload y se
 * muestra en pantalla— pero su mensaje apunta a la tasa, que es lo que habría
 * que arreglar si saliera mal, y no al campo, que no se puede escribir.
 */
const derived = z
  .number({ error: 'Falta el tipo de cambio para calcular el precio en córdobas.' })
  .finite('Falta el tipo de cambio para calcular el precio en córdobas.')
  .positive('El precio en córdobas debe ser mayor que cero.')
  .max(10000000, 'El precio en córdobas es demasiado alto.')
const pair = z.object({ NIO: derived, USD: money })
export const productInputSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().min(0),
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre del perfume.')
    .max(200, 'Usa 200 caracteres como máximo.'),
  brand: z
    .string()
    .trim()
    .min(1, 'Escribe la marca.')
    .max(100, 'Usa 100 caracteres como máximo.'),
  category: z.enum(['arabian', 'designer', 'niche', 'unspecified']),
  gender: z.enum(['male', 'female', 'unisex', 'unspecified']),
  size: z
    .number({ error: 'Escribe un tamaño o deja el campo vacío.' })
    .finite('Escribe un tamaño o deja el campo vacío.')
    .positive('El tamaño debe ser mayor que cero.')
    .max(99999, 'El tamaño es demasiado grande.')
    .nullable(),
  unit: z.enum(['oz', 'ml']),
  manufacturerBarcode: z
    .string()
    .regex(
      /^(?:[0-9]{8}|[0-9]{12,14})?$/,
      'El código del fabricante lleva 8, 12, 13 o 14 dígitos, o se deja vacío.',
    ),
  minimumStock: z
    .number({ error: 'Escribe el mínimo de inventario.' })
    .int('Usa una cantidad entera.')
    .min(0, 'El mínimo no puede ser negativo.')
    .max(1000000, 'El mínimo es demasiado alto.'),
  active: z.boolean(),
  imagePath: z.string().max(250).nullable(),
  prices: z.object({ emprendedor: pair, vip: pair, premium: pair }),
})
export type ProductInput = z.infer<typeof productInputSchema>
/** Precio en córdobas del catálogo: el de dólares por la tasa vigente. */
export function nioFromUsd(usd: number, rate: number | null): number {
  if (rate === null || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(usd))
    return NaN
  return Math.max(Math.round(usd * rate * 100) / 100, 0.01)
}
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
    if (blob && blob.type !== 'image/webp')
      throw new Error(
        'Este navegador no pudo convertir la foto a WebP. Usa un navegador actualizado.',
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
