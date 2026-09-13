export type UserRole = 'admin' | 'operator'
export interface UserProfile {
  id: string
  email: string
  role: UserRole | null
}
export type Currency = 'NIO' | 'USD'
export type InventoryLocation = 'warehouse' | 'store'
export type Category = 'arabian' | 'designer' | 'niche' | 'unspecified'
export type Gender = 'male' | 'female' | 'unisex' | 'unspecified'
export type PriceTier = 'emprendedor' | 'vip' | 'premium'
export type PaymentMethod = 'cash' | 'card_pos' | 'bank_transfer'
export type Bank = 'BAC' | 'LAFISE' | 'FICOSA'
export interface Product {
  id: string
  barcode: string
  barcodeKind?: 'internal' | 'manufacturer'
  manufacturerBarcode?: string | null
  name: string
  brand: string
  category: Category
  gender: Gender
  size: number | null
  unit: 'ml' | 'oz'
  price: number
  currency: Currency
  minimumStock: number | null
  active: boolean
  prices?: Record<PriceTier, Record<Currency, number>>
  imageUrl?: string | null
  imageSource?: string | null
  availabilityNote?: string
  sourceRow?: number
  sizeSource?: string
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
}
export interface Supplier {
  id: string
  name: string
}
export interface BusinessSettings {
  name: string
  address: string
  phone: string
}
export interface CustomerRecord {
  id: string
  name: string
  phone: string | null
  priceTier: PriceTier
}
// Facturas descuentan inventario; las proformas sólo cotizan. El tipo nunca se
// deduce del contenido: viaja explícito desde la pantalla hasta PostgreSQL.
export type DocumentKind = 'invoice' | 'proforma'
export interface DocumentItemRecord {
  id: string
  productId: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}
export interface DocumentRecord {
  id: string
  kind: DocumentKind
  number: string
  customerId: string
  customerName: string
  customerPhone: string | null
  issuer: BusinessSettings
  tier: PriceTier
  currency: Currency
  total: number
  location: InventoryLocation | null
  validUntil: string | null
  paymentMethod: PaymentMethod | 'pending' | null
  notes: string
  createdAt: string
  items: DocumentItemRecord[]
}
export interface NewDocumentItem {
  productId: string
  quantity: number
}
export interface NewDocument {
  requestId: string
  kind: DocumentKind
  customerId?: string | null
  customerName?: string
  customerPhone?: string | null
  tier: PriceTier
  currency: Currency
  location?: InventoryLocation | null
  paymentMethod?: PaymentMethod | 'pending' | null
  validUntil?: string | null
  notes: string
  items: NewDocumentItem[]
}
export interface MovementRequest {
  requestId: string
  productId: string
  location: InventoryLocation
  type: 'ENTRY' | 'EXIT' | 'DAMAGED' | 'ADJUSTMENT'
  quantity: number
  reference?: string
  note: string
}
export const labels = {
  category: {
    arabian: 'Árabe',
    designer: 'Diseñador',
    niche: 'Nicho',
    unspecified: 'Por confirmar',
  },
  gender: {
    male: 'Masculino',
    female: 'Femenino',
    unisex: 'Unisex',
    unspecified: 'Por confirmar',
  },
  location: { warehouse: 'Bodega', store: 'Tienda' },
  payment: {
    cash: 'Efectivo',
    card_pos: 'POS / Tarjeta',
    bank_transfer: 'Transferencia bancaria',
  },
  documentKind: { invoice: 'Factura', proforma: 'Proforma' },
}
export const documentCopy: Record<
  DocumentKind,
  {
    title: string
    singular: string
    plural: string
    stamp: string
    prefix: string
    subtitle: string
    notice: string
  }
> = {
  invoice: {
    title: 'Facturación',
    singular: 'factura',
    plural: 'facturas',
    stamp: 'FACTURA',
    prefix: 'FAC-',
    subtitle: 'Cobra y descuenta del inventario.',
    notice:
      'Al emitirla se descuentan las existencias de la ubicación elegida y queda registrada en el historial. No es un comprobante fiscal y no calcula impuestos.',
  },
  proforma: {
    title: 'Proformas',
    singular: 'proforma',
    plural: 'proformas',
    stamp: 'PROFORMA',
    prefix: 'PRO-',
    subtitle: 'Cotiza sin cobrar ni mover inventario.',
    notice:
      'Es una cotización con vigencia. No cobra, no descuenta existencias y no sustituye a una factura. Los precios rigen hasta la fecha de vigencia indicada.',
  },
}
