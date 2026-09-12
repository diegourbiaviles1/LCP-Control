import type { InventoryItem, Product, InventoryMovement } from '../../lib/domain'
import type { DataProvider } from '../contracts'
// Generic fixtures only; no business records and no mutable stock endpoint.
const specifications = [
  ['A', 'arabian', 'unisex', 18, 12, 10, 1250],
  ['B', 'designer', 'female', 2, 1, 8, 1800],
  ['C', 'arabian', 'male', 24, 16, 12, 1450],
  ['D', 'designer', 'unisex', 0, 0, 6, 2100],
  ['E', 'arabian', 'female', 14, 8, 10, 1350],
  ['F', 'designer', 'male', 4, 2, 8, 1950],
  ['G', 'arabian', 'unisex', 20, 11, 10, 1500],
  ['H', 'designer', 'female', 9, 6, 8, 1700],
] as const
const items: InventoryItem[] = specifications.map(
  (
    [letter, category, gender, warehouse, store, minimumStock, price],
    index,
  ) => ({
    product: {
      id: `demo-${letter.toLowerCase()}`,
      barcode: `LCP-${String(index + 1).padStart(4, '0')}`,
      name: `Producto ${letter}`,
      brand: 'Marca',
      category,
      gender,
      size: 100,
      unit: 'ml',
      price,
      currency: 'NIO',
      minimumStock,
      active: true,
    } satisfies Product,
    quantities: { warehouse, store },
  }),
)
const movements: InventoryMovement[] = []
export const demoAdapter: DataProvider = {
  mode: 'demo',
  async getInventory() {
    return structuredClone(items)
  },
  async findByBarcode(code) {
    return structuredClone(
      items.find((item) => item.product.barcode === code)?.product ?? null,
    )
  },
  async getTodaySummary() {
    return { count: 0, totals: { NIO: 0, USD: 0 } }
  },
  async createInventoryMovement(movement) {
    const newMovement: InventoryMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    }
    movements.push(newMovement)
    
    // Update inventory quantities based on movement
    const itemIndex = items.findIndex(item => item.product.id === movement.productId)
    if (itemIndex !== -1) {
      const item = items[itemIndex]
      switch (movement.type) {
        case 'ENTRY':
          item.quantities[movement.location] += movement.quantity
          break
        case 'EXIT':
          item.quantities[movement.location] -= movement.quantity
          break
        case 'DAMAGED':
          item.quantities[movement.location] -= movement.quantity
          break
        case 'ADJUSTMENT':
          // For adjustment, we assume the quantities are updated directly
          // In a real implementation this would depend on specific requirements
          break
      }
    }
  },
}
