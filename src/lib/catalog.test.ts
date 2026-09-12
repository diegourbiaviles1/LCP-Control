import { describe, expect, it } from 'vitest'
import { catalogAdapter, catalogProducts } from '../services/adapters/catalog'
import { createServices } from '../services'
import {
  emptyFilters,
  filterInventory,
  stockStatus,
  totalStock,
} from '../features/inventory/model'
import { lineCents } from './pricing'
import { invoiceTotal, type InvoiceLine } from '../features/sales/invoice'
import { nextReflection, reflections } from '../features/dashboard/quotes'
describe('catalog imported from the three price lists', () => {
  it('keeps all 260 variants, unique internal identifiers and the source prices', () => {
    expect(catalogProducts).toHaveLength(260)
    expect(new Set(catalogProducts.map((p) => p.barcode)).size).toBe(260)
    expect(catalogProducts[0].prices).toEqual({
      emprendedor: { NIO: 1295, USD: 35 },
      vip: { NIO: 1221, USD: 33 },
      premium: { NIO: 1110, USD: 30 },
    })
    expect(
      catalogProducts.every(
        (p) => p.barcodeKind === 'internal' && p.manufacturerBarcode === null,
      ),
    ).toBe(true)
    expect(catalogProducts.filter((p) => p.imageUrl)).toHaveLength(258)
    expect(catalogProducts.filter((p) => p.size === null)).toHaveLength(4)
  })
  it('does not turn unknown stock into zero or low-stock alerts', async () => {
    const items = await catalogAdapter.getInventory()
    expect(
      items.every(
        (item) => totalStock(item) === null && stockStatus(item) === 'unknown',
      ),
    ).toBe(true)
    expect(
      await createServices(catalogAdapter).inventoryService.getLowStock(),
    ).toEqual([])
    expect(filterInventory(items, { ...emptyFilters, stock: 'out' })).toEqual(
      [],
    )
    expect(
      filterInventory(items, { ...emptyFilters, stock: 'unknown' }),
    ).toHaveLength(260)
  })
  it('finds exact internal codes and combines brand, size and category filters', async () => {
    const first = catalogProducts[0]
    expect(
      (
        await createServices(catalogAdapter).productService.findByBarcode(
          ` ${first.barcode} `,
        )
      )?.id,
    ).toBe(first.id)
    const items = await catalogAdapter.getInventory()
    const filtered = filterInventory(items, {
      ...emptyFilters,
      category: 'niche',
      brand: 'Xerjoff',
      size: '3.4 oz',
    })
    expect(filtered.map((i) => i.product.name)).toEqual(['Erba pura'])
  })
})
describe('invoice arithmetic', () => {
  const p = catalogProducts[0]
  const lines: InvoiceLine[] = [
    {
      productId: p.id,
      name: p.name,
      barcode: p.barcode,
      size: '3.4 oz',
      quantity: 3,
      prices: p.prices!,
    },
  ]
  it('selects the quoted price for each currency and tier, preserving quantity', () => {
    expect(invoiceTotal(lines, 'emprendedor', 'NIO')).toBe(3885)
    expect(invoiceTotal(lines, 'emprendedor', 'USD')).toBe(105)
    expect(invoiceTotal(lines, 'premium', 'USD')).toBe(90)
    expect(invoiceTotal(lines, 'premium', 'NIO')).toBe(3330)
    expect(lines[0].quantity).toBe(3)
  })
  it('rounds at the cent and rejects invalid quantities', () => {
    expect(lineCents(19.99, 3)).toBe(5997)
    for (const quantity of [0, -1, 1.5, NaN, Infinity])
      expect(() => lineCents(10, quantity)).toThrow()
  })
})
describe('reflection rotation', () => {
  it('uses every reflection before repeating and avoids an immediate cycle repeat', () => {
    let value: string | null = null
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next
      },
    }
    const seen = Array.from({ length: reflections.length }, () =>
      nextReflection(storage, () => 0),
    )
    expect(new Set(seen).size).toBe(reflections.length)
    expect(nextReflection(storage, () => 0)).not.toBe(seen.at(-1))
  })
  it('tolerates corrupt or unavailable storage', () => {
    expect(reflections).toContain(
      nextReflection({
        getItem: () => '{broken',
        setItem: () => {
          throw new Error('blocked')
        },
      }),
    )
  })
})
