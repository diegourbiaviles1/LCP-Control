import catalog from '../../data/catalog.json'
import type { Product, InventoryItem } from '../../lib/domain'
import type { DataProvider } from '../contracts'
export const catalogProducts = catalog as Product[]
const items: InventoryItem[] = catalogProducts.map((product) => ({
  product,
  quantities: { warehouse: null, store: null },
}))
export const catalogAdapter: DataProvider = {
  mode: 'demo',
  async getInventory() {
    return structuredClone(items)
  },
  async findByBarcode(code) {
    return structuredClone(
      catalogProducts.find(
        (product) =>
          product.barcode === code || product.manufacturerBarcode === code,
      ) ?? null,
    )
  },
  async getTodaySummary() {
    return { count: 0, totals: { NIO: 0, USD: 0 } }
  },
}
