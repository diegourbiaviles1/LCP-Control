import type { InventoryItem, Product, Customer, BusinessDocument, DocumentInput, DocumentKind, MovementInput } from '../lib/domain'
export interface DataProvider {
  readonly mode: 'demo' | 'supabase'
  getInventory(): Promise<InventoryItem[]>
  findByBarcode(code: string): Promise<Product | null>
  getTodaySummary(): Promise<{ count: number; totals: { NIO: number; USD: number } }>
  createInventoryMovement(movement: MovementInput): Promise<void>
  getCustomers(): Promise<Customer[]>
  getDocuments(kind: DocumentKind): Promise<BusinessDocument[]>
  createDocument(input: DocumentInput): Promise<BusinessDocument>
}
