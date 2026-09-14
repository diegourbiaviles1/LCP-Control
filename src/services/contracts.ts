import type {
  BusinessSettings,
  CustomerRecord,
  DocumentKind,
  DocumentRecord,
  ExchangeRate,
  InventoryItem,
  MovementRequest,
  NewDocument,
  Product,
} from '../lib/domain'
import type { ProductInput } from '../features/products/product'
import type { ReportRange, ReportSource } from '../features/reports/model'
import type {
  ExpenseInput,
  OpeningCostInput,
  PurchaseInput,
} from '../features/reports/accounting'
export interface DataProvider {
  listProducts(): Promise<Product[]>
  saveProduct(input: ProductInput): Promise<string>
  removeProduct(id: string, revision: number): Promise<'archived' | 'deleted'>
  uploadProductImage(blob: Blob): Promise<string>
  readonly mode: 'demo' | 'supabase'
  getInventory(includeInactive?: boolean): Promise<InventoryItem[]>
  findByBarcode(code: string): Promise<Product | null>
  getTodaySummary(): Promise<{
    count: number
    totals: { NIO: number; USD: number }
  }>
  getBusiness(): Promise<BusinessSettings>
  /** `null` mientras nadie haya registrado una tasa. */
  getExchangeRate(): Promise<ExchangeRate | null>
  saveExchangeRate(rate: number): Promise<void>
  listCustomers(): Promise<CustomerRecord[]>
  listDocuments(kind: DocumentKind, limit?: number): Promise<DocumentRecord[]>
  createDocument(input: NewDocument): Promise<DocumentRecord>
  recordMovement(input: MovementRequest): Promise<string>
  /** Filas crudas del periodo; los reportes se calculan sobre ellas. */
  getReportSource(range: ReportRange): Promise<ReportSource>
  recordPurchase(input: PurchaseInput): Promise<string>
  setOpeningCost(input: OpeningCostInput): Promise<string>
  recordExpense(input: ExpenseInput): Promise<string>
  voidExpense(id: string, reason: string): Promise<string>
}
