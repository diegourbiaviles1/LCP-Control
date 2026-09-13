export type UserRole = 'admin' | 'operator'
export interface UserProfile {
  id: string
  email: string
  role: UserRole | null
}
export type Currency = 'NIO' | 'USD'
export type InventoryLocation = 'warehouse' | 'store'
export type Category = 'arabian' | 'designer' | 'unspecified'
export type Gender = 'male' | 'female' | 'unisex' | 'unspecified'
export type PaymentMethod = 'cash' | 'card_pos' | 'bank_transfer'
export type Bank = 'BAC' | 'LAFISE' | 'FICOSA'
export interface Product {
  id: string
  barcode: string
  name: string
  brand: string
  category: Category
  gender: Gender
  size: number | null
  unit: 'ml' | 'oz'
  sku?: string
  prices?: ProductPrice[]
  price: number
  currency: Currency
  minimumStock: number
  active: boolean
}
// Costs belong to a separate administrative projection, never to inventory reads.
export interface ProductCost {
  productId: string
  averageCost: string
  currency: Currency
}
export interface InventoryItem {
  product: Product
  quantities: Record<InventoryLocation, number | null>
}
export type MovementType =
  'ENTRY' | 'EXIT' | 'DAMAGED' | 'ADJUSTMENT' | 'TRANSFER' | 'SALE'
export interface InventoryMovement {
  id: string
  productId: string
  location: InventoryLocation
  quantity: number
  type: MovementType
  actorId: string
  createdAt: string
  reference: string | null
  note: string
}
export interface SaleItem {
  productId: string
  quantity: number
  unitPrice: string
}
export interface Sale {
  id: string
  currency: Currency
  items: SaleItem[]
  createdAt: string
}
export interface Customer {
  id: string
  name: string
  phone: string | null
  priceTier: PriceTier
}
export interface Supplier {
  id: string
  name: string
}
export type PriceTier = 'emprendedor' | 'vip' | 'premium'
export type DocumentKind = 'invoice' | 'proforma'
export interface ProductPrice { tier: PriceTier; currency: Currency; amount: number }
export interface DocumentInput {
  requestId: string
  kind: DocumentKind
  customerId: string | null
  customerName: string
  customerPhone: string
  currency: Currency
  tier: PriceTier
  location: InventoryLocation | null
  validUntil: string | null
  paymentMethod: PaymentMethod | 'pending' | null
  notes: string
  items: { productId: string; quantity: number }[]
}
export interface BusinessDocument {
  id: string
  kind: DocumentKind
  number: string
  customerId: string
  customerName: string
  customerPhone: string | null
  issuer: { name: string; address: string; phone: string }
  currency: Currency
  tier: PriceTier
  total: number
  createdAt: string
  validUntil: string | null
  paymentMethod: PaymentMethod | 'pending' | null
  notes: string
  demo: boolean
  items: { productId: string; description: string; quantity: number; unitPrice: number; lineTotal: number }[]
}
export interface MovementInput {
  requestId: string
  productId: string
  location: InventoryLocation
  type: 'ENTRY' | 'EXIT' | 'DAMAGED' | 'ADJUSTMENT'
  quantity: number
  reference: string | null
  note: string
}
export const labels = {
  category: { arabian: 'Árabe', designer: 'Diseñador', unspecified: 'Por clasificar' },
  gender: { male: 'Masculino', female: 'Femenino', unisex: 'Unisex', unspecified: 'Por clasificar' },
  location: { warehouse: 'Bodega', store: 'Tienda' },
  payment: {
    cash: 'Efectivo',
    card_pos: 'POS / Tarjeta',
    bank_transfer: 'Transferencia bancaria',
  },
}
