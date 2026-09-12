import type { InventoryItem, Product, InventoryMovement } from '../lib/domain'
export interface DataProvider {
  readonly mode: 'demo'
  getInventory(): Promise<InventoryItem[]>
  findByBarcode(code: string): Promise<Product | null>
  getTodaySummary(): Promise<{
    count: number
    totals: { NIO: number; USD: number }
  }>
  createInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<void>
}
