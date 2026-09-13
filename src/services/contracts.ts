import type {
  BusinessSettings,
  CustomerRecord,
  DocumentKind,
  DocumentRecord,
  InventoryItem,
  MovementRequest,
  NewDocument,
  Product,
} from '../lib/domain'
import type { ProductInput } from '../features/products/product'
export interface DataProvider {
  listProducts(): Promise<Product[]>
  saveProduct(input: ProductInput): Promise<string>
  removeProduct(id: string, revision: number): Promise<'archived' | 'deleted'>
  uploadProductImage(blob: Blob): Promise<string>
  readonly mode: 'demo' | 'supabase'
  getInventory(): Promise<InventoryItem[]>
  findByBarcode(code: string): Promise<Product | null>
  getTodaySummary(): Promise<{
    count: number
    totals: { NIO: number; USD: number }
  }>
  getBusiness(): Promise<BusinessSettings>
  listCustomers(): Promise<CustomerRecord[]>
  listDocuments(kind: DocumentKind, limit?: number): Promise<DocumentRecord[]>
  createDocument(input: NewDocument): Promise<DocumentRecord>
  recordMovement(input: MovementRequest): Promise<string>
}
