import { AppError } from '../../lib/errors'
import type { BusinessSettings, DocumentKind } from '../../lib/domain'
import type { DataProvider } from '../contracts'
// Shared by the catalog and demo providers: the local views read the catalogue
// but must never look as if they issued a document or moved real stock.
// Invented business details: the local view never shows the real ones.
export const localBusiness: BusinessSettings = {
  name: 'La Casa del Perfume · vista local',
  address: 'Dirección de prueba',
  phone: '(+505) 5555-0100',
}
function unavailable(): never {
  throw new AppError(
    'configuration',
    'La vista local no emite documentos ni modifica inventario. Inicia sesión para trabajar con la base de datos.',
  )
}
function missingConfiguration(): never {
  throw new AppError(
    'configuration',
    'Falta la configuración de Supabase. Esta compilación no incluye datos locales.',
  )
}
// Production build without a configured project: nothing to read or write.
export const unconfiguredAdapter: DataProvider = {
  listProducts: async () => missingConfiguration(),
  saveProduct: async () => missingConfiguration(),
  removeProduct: async () => missingConfiguration(),
  uploadProductImage: async () => missingConfiguration(),
  mode: 'demo',
  getInventory: async () => missingConfiguration(),
  findByBarcode: async () => missingConfiguration(),
  getTodaySummary: async () => missingConfiguration(),
  getBusiness: async () => missingConfiguration(),
  listCustomers: async () => missingConfiguration(),
  listDocuments: async () => missingConfiguration(),
  createDocument: async () => missingConfiguration(),
  recordMovement: async () => missingConfiguration(),
}
export const localWrites = {
  listProducts: async () => unavailable(),
  saveProduct: async () => unavailable(),
  removeProduct: async () => unavailable(),
  uploadProductImage: async () => unavailable(),
  async getBusiness(): Promise<BusinessSettings> {
    return { ...localBusiness }
  },
  async listCustomers() {
    return []
  },
  async listDocuments(_kind: DocumentKind, _limit?: number) {
    void _kind
    void _limit
    return []
  },
  createDocument: async () => unavailable(),
  recordMovement: async () => unavailable(),
}
