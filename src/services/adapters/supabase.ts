import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type {
  BusinessSettings,
  Category,
  Currency,
  CustomerRecord,
  DocumentKind,
  DocumentRecord,
  Gender,
  InventoryItem,
  InventoryLocation,
  MovementRequest,
  NewDocument,
  PaymentMethod,
  PriceTier,
  Product,
} from '../../lib/domain'
import type { DataProvider } from '../contracts'

interface PriceRow {
  tier_code: PriceTier
  currency: Currency
  amount: number | string
}
interface BalanceRow {
  location: InventoryLocation
  quantity: number | null
}
interface ProductRow {
  id: string
  sku: string
  barcode: string | null
  name: string
  size: number | string | null
  unit: 'oz' | 'ml'
  category: 'arabian' | 'designer' | null
  gender: 'male' | 'female' | 'unisex' | null
  catalog_availability: 'sold_out' | 'unspecified' | null
  image_reference: string | null
  minimum_stock: number | null
  active: boolean
  brands: { name: string } | null
  product_prices: PriceRow[]
  inventory_balances: BalanceRow[]
}
interface DocumentItemRow {
  id: string
  product_id: string
  description: string
  quantity: number
  unit_price: number | string
  line_total: number | string
}
interface DocumentRow {
  id: string
  kind: DocumentKind
  number: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  issuer: BusinessSettings
  tier_code: PriceTier
  currency: Currency
  total: number | string
  location: InventoryLocation | null
  valid_until: string | null
  payment_method: PaymentMethod | 'pending' | null
  notes: string
  created_at: string
  document_items: DocumentItemRow[] | null
}

const productSelect = `id,sku,barcode,name,size,unit,category,gender,catalog_availability,
image_reference,minimum_stock,active,brands(name),
product_prices(tier_code,currency,amount),
inventory_balances(location,quantity)`
const documentSelect = `id,kind,number,customer_id,customer_name,customer_phone,issuer,tier_code,
currency,total,location,valid_until,payment_method,notes,created_at,
document_items(id,product_id,description,quantity,unit_price,line_total)`

// PostgREST returns numeric as string to preserve precision; parse explicitly.
function amount(value: number | string | null): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return parsed === null || !Number.isFinite(parsed) ? 0 : parsed
}
function client() {
  if (!supabase)
    throw new AppError(
      'configuration',
      'Falta la configuración de Supabase. Revisa VITE_SUPABASE_URL y la clave publicable.',
    )
  return supabase
}
// Supabase errors carry Postgres messages written for the operator in Spanish;
// everything else is reported generically so internals never leak to the screen.
export function toAppError(
  error: { message?: string; code?: string } | null,
): AppError {
  const message = error?.message?.trim()
  const readable = message && message.length <= 300 ? message : null
  if (error?.code === 'PGRST301' || error?.code === '42501')
    return new AppError(
      'unauthorized',
      'Tu cuenta no tiene permiso para esta operación.',
    )
  // HTTP 429 from private.enforce_rate_limit; its message says how long to wait.
  if (error?.code === 'LCP429')
    return new AppError(
      'rate_limited',
      readable ?? 'Demasiadas operaciones seguidas. Espera un momento.',
    )
  if (error?.code === 'P0001')
    return new AppError(
      'validation',
      readable ?? 'Revisa los datos de la operación.',
    )
  return new AppError(
    'unexpected',
    'No pudimos completar la operación. Inténtalo de nuevo.',
  )
}
function fail(error: { message?: string; code?: string } | null): never {
  throw toAppError(error)
}
function emptyPrices(): Record<PriceTier, Record<Currency, number>> {
  return {
    emprendedor: { NIO: 0, USD: 0 },
    vip: { NIO: 0, USD: 0 },
    premium: { NIO: 0, USD: 0 },
  }
}
// image_reference guarda el enlace original de Drive tal como venía en el Excel.
// De ahí se deriva la miniatura; si algún día se guarda sólo el id, también sirve.
function driveId(reference: string | null): string | null {
  if (!reference) return null
  const match =
    /\/d\/([A-Za-z0-9_-]+)/.exec(reference) ??
    /[?&]id=([A-Za-z0-9_-]+)/.exec(reference)
  if (match) return match[1]
  return /^[A-Za-z0-9_-]{10,}$/.test(reference) ? reference : null
}
function toProduct(row: ProductRow): Product {
  const prices = emptyPrices()
  for (const price of row.product_prices ?? [])
    prices[price.tier_code][price.currency] = amount(price.amount)
  const size = row.size === null ? null : amount(row.size)
  const category: Category = row.category ?? 'unspecified'
  const gender: Gender = row.gender ?? 'unspecified'
  const image = driveId(row.image_reference)
  return {
    id: row.id,
    barcode: row.sku,
    barcodeKind: 'internal',
    manufacturerBarcode: row.barcode,
    name: row.name,
    brand: row.brands?.name ?? 'Sin marca',
    category,
    gender,
    size,
    unit: row.unit,
    price: prices.emprendedor.NIO,
    currency: 'NIO',
    prices,
    minimumStock: row.minimum_stock ?? null,
    active: row.active,
    availabilityNote:
      row.catalog_availability === 'sold_out' ? 'Agotado' : 'Por confirmar',
    imageUrl: image
      ? `https://drive.google.com/thumbnail?id=${image}&sz=w400`
      : null,
    imageSource: row.image_reference,
  }
}
function toItem(row: ProductRow): InventoryItem {
  const quantities: Record<InventoryLocation, number | null> = {
    warehouse: null,
    store: null,
  }
  for (const balance of row.inventory_balances ?? [])
    quantities[balance.location] = balance.quantity
  return { product: toProduct(row), quantities }
}
function toDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    kind: row.kind,
    number: row.number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    issuer: row.issuer,
    tier: row.tier_code,
    currency: row.currency,
    total: amount(row.total),
    location: row.location,
    validUntil: row.valid_until,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: row.created_at,
    items: (row.document_items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: amount(item.unit_price),
      lineTotal: amount(item.line_total),
    })),
  }
}

export const supabaseAdapter: DataProvider = {
  mode: 'supabase',
  async getInventory() {
    const { data, error } = await client()
      .from('products')
      .select(productSelect)
      .eq('active', true)
      .order('name')
      .limit(2000)
    if (error) fail(error)
    return ((data ?? []) as unknown as ProductRow[]).map(toItem)
  },
  // Two equality filters instead of an `or(...)` string: the scanned code is
  // never interpolated into PostgREST filter syntax.
  async findByBarcode(code) {
    for (const column of ['barcode', 'sku'] as const) {
      const { data, error } = await client()
        .from('products')
        .select(productSelect)
        .eq(column, code)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (error) fail(error)
      if (data) return toProduct(data as unknown as ProductRow)
    }
    return null
  },
  async getTodaySummary() {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    const { data, error } = await client()
      .from('documents')
      .select('currency,total')
      .eq('kind', 'invoice')
      .gte('created_at', since.toISOString())
      .limit(1000)
    if (error) fail(error)
    const rows = (data ?? []) as {
      currency: Currency
      total: number | string
    }[]
    return {
      count: rows.length,
      totals: {
        NIO: rows
          .filter((row) => row.currency === 'NIO')
          .reduce((sum, row) => sum + amount(row.total), 0),
        USD: rows
          .filter((row) => row.currency === 'USD')
          .reduce((sum, row) => sum + amount(row.total), 0),
      },
    }
  },
  async getBusiness() {
    const { data, error } = await client()
      .from('business_settings')
      .select('name,address,phone')
      .limit(1)
      .maybeSingle()
    if (error) fail(error)
    if (!data)
      throw new AppError(
        'configuration',
        'Falta configurar los datos del negocio en la base de datos.',
      )
    return data as BusinessSettings
  },
  async listCustomers() {
    const { data, error } = await client()
      .from('customers')
      .select('id,name,phone,price_tier')
      .order('name')
      .limit(500)
    if (error) fail(error)
    return (
      (data ?? []) as {
        id: string
        name: string
        phone: string | null
        price_tier: PriceTier
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      priceTier: row.price_tier,
    })) satisfies CustomerRecord[]
  },
  async listDocuments(kind, limit = 25) {
    const { data, error } = await client()
      .from('documents')
      .select(documentSelect)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) fail(error)
    return ((data ?? []) as unknown as DocumentRow[]).map(toDocument)
  },
  async createDocument(input: NewDocument) {
    // requestId makes the call idempotent: a retry returns the same document
    // instead of issuing a second one or discounting stock twice.
    const { data, error } = await client().rpc('create_document', {
      p_payload: {
        requestId: input.requestId,
        kind: input.kind,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? '',
        customerPhone: input.customerPhone ?? null,
        tier: input.tier,
        currency: input.currency,
        location: input.location ?? null,
        paymentMethod: input.paymentMethod ?? null,
        validUntil: input.validUntil ?? null,
        notes: input.notes,
        items: input.items,
      },
    })
    if (error) fail(error)
    return toDocument(data as unknown as DocumentRow)
  },
  async recordMovement(input: MovementRequest) {
    const { data, error } = await client().rpc('record_inventory_movement', {
      p_payload: {
        requestId: input.requestId,
        productId: input.productId,
        location: input.location,
        type: input.type,
        quantity: input.quantity,
        reference: input.reference ?? '',
        note: input.note,
      },
    })
    if (error) fail(error)
    return data as string
  },
}
