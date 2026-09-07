export type UserRole = 'admin' | 'operator'
export interface UserProfile {
  id: string
  email: string
  role: UserRole | null
}
export type Currency = 'NIO' | 'USD'
export type InventoryLocation = 'warehouse' | 'store'
export type Category = 'arabian' | 'designer'
export type Gender = 'male' | 'female' | 'unisex'
export type PaymentMethod = 'cash' | 'card_pos' | 'bank_transfer'
export type Bank = 'BAC' | 'LAFISE' | 'FICOSA'
export interface Product {
  id: string
  barcode: string
  name: string
  brand: string
  category: Category
  gender: Gender
  size: number
  unit: 'ml'
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
  quantities: Record<InventoryLocation, number>
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
}
export interface Supplier {
  id: string
  name: string
}
export const labels = {
  category: { arabian: 'Árabe', designer: 'Diseñador' },
  gender: { male: 'Masculino', female: 'Femenino', unisex: 'Unisex' },
  location: { warehouse: 'Bodega', store: 'Tienda' },
  payment: {
    cash: 'Efectivo',
    card_pos: 'POS / Tarjeta',
    bank_transfer: 'Transferencia bancaria',
  },
}
