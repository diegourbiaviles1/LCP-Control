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
export interface DataProvider {
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
