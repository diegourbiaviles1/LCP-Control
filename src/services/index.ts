import { catalogAdapter } from './adapters/catalog'
import { supabaseAdapter } from './adapters/supabase'
import { unconfiguredAdapter } from './adapters/local'
import { barcodeSchema } from '../lib/validation'
import { AppError } from '../lib/errors'
import { authConfigured } from '../lib/supabase'
import type { DataProvider } from './contracts'
import { totalStock } from '../features/inventory/model'
import type { DocumentKind, MovementRequest, NewDocument } from '../lib/domain'
export function createServices(provider: DataProvider) {
  return {
    mode: provider.mode,
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
      recordMovement: (input: MovementRequest) =>
        provider.recordMovement(input),
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
    salesService: {
      getTodaySummary: () => provider.getTodaySummary(),
      getBusiness: () => provider.getBusiness(),
      listCustomers: () => provider.listCustomers(),
      listDocuments: (kind: DocumentKind, limit?: number) =>
        provider.listDocuments(kind, limit),
      createDocument: (input: NewDocument) => provider.createDocument(input),
    },
  }
}
// `supabase` is the only mode that reads and writes real records; it requires a
// configured project and a signed-in staff account. The synthetic local catalog
// exists only in development and tests: a production build without Supabase
// fails closed instead of serving a catalogue to anyone.
const dataMode = import.meta.env.VITE_DATA_MODE || 'demo'
export const realDataEnabled = dataMode === 'supabase' && authConfigured
export const privateServices = createServices(
  realDataEnabled ? supabaseAdapter : unconfiguredAdapter,
)
export const demoServices = createServices(
  import.meta.env.DEV ? catalogAdapter : unconfiguredAdapter,
)
