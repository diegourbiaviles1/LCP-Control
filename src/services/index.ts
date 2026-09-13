import { demoAdapter } from './adapters/demo'
import { supabaseAdapter } from './adapters/supabase'
import { barcodeSchema } from '../lib/validation'
import { AppError } from '../lib/errors'
import type { DataProvider } from './contracts'
import type { DocumentInput, DocumentKind, MovementInput } from '../lib/domain'
import { totalStock } from '../features/inventory/model'
export function createServices(provider: DataProvider) {
  return {
    productService: {
      async findByBarcode(code: string) {
        const parsed = barcodeSchema.safeParse(code)
        if (!parsed.success) throw new AppError('validation', parsed.error.issues[0].message)
        return provider.findByBarcode(parsed.data)
      },
    },
    inventoryService: {
      getInventory: () => provider.getInventory(),
      async getLowStock() {
        return (await provider.getInventory()).filter(item => {
          const total = totalStock(item)
          return total !== null && total < item.product.minimumStock
        })
      },
      createInventoryMovement: (movement: MovementInput) => provider.createInventoryMovement(movement),
    },
    salesService: { getTodaySummary: () => provider.getTodaySummary() },
    documentService: {
      getCustomers: () => provider.getCustomers(),
      getDocuments: (kind: DocumentKind) => provider.getDocuments(kind),
      createDocument: (input: DocumentInput) => provider.createDocument(input),
    },
  }
}
export const demoServices = createServices(demoAdapter)
export const liveServices = createServices(supabaseAdapter)
