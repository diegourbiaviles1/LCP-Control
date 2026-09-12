import { catalogAdapter } from './adapters/catalog'
import { barcodeSchema } from '../lib/validation'
import { AppError } from '../lib/errors'
import type { DataProvider } from './contracts'
import { totalStock } from '../features/inventory/model'
export function createServices(provider: DataProvider) {
  return {
    productService: {
      async findByBarcode(code: string) {
        const parsed = barcodeSchema.safeParse(code)
        if (!parsed.success)
          throw new AppError('validation', parsed.error.issues[0].message)
        return provider.findByBarcode(parsed.data)
      },
    },
    inventoryService: {
      getInventory: () => provider.getInventory(),
      async getLowStock() {
        return (await provider.getInventory()).filter((item) => {
          const total = totalStock(item)
          return (
            total !== null &&
            item.product.minimumStock !== null &&
            total < item.product.minimumStock
          )
        })
      },
    },
    salesService: { getTodaySummary: () => provider.getTodaySummary() },
  }
}
// Iteration 1 intentionally exposes no real data or write operations.
const dataMode = import.meta.env.VITE_DATA_MODE || 'demo'
const provider: DataProvider =
  dataMode === 'demo'
    ? catalogAdapter
    : {
        mode: 'demo',
        getInventory: async () => {
          throw new AppError(
            'configuration',
            'El proveedor de datos reales aún no está implementado.',
          )
        },
        findByBarcode: async () => {
          throw new AppError(
            'configuration',
            'El proveedor de datos reales aún no está implementado.',
          )
        },
        getTodaySummary: async () => {
          throw new AppError(
            'configuration',
            'El proveedor de datos reales aún no está implementado.',
          )
        },
      }
export const { productService, inventoryService, salesService } =
  createServices(provider)
