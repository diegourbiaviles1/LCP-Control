import type { InventoryItem, Product } from '../lib/domain'
export interface DataProvider {
  readonly mode: 'demo'
  getInventory(): Promise<InventoryItem[]>
  findByBarcode(code: string): Promise<Product | null>
  getTodaySummary(): Promise<{
    count: number
    totals: { NIO: number; USD: number }
  }>
}
