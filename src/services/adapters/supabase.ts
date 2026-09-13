import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type { DataProvider } from '../contracts'
import type { BusinessDocument, Customer, InventoryItem, Product, PriceTier, Currency, Category, Gender, InventoryLocation } from '../../lib/domain'
import { localDate, validateDocument } from '../../features/sales/documents'
function client() {
  if (!supabase) throw new AppError('configuration','Falta conectar Supabase. Configura la URL y la clave publicable del proyecto.')
  return supabase
}
function check(error: { message: string; code?: string } | null) {
  if (error) throw new AppError('unexpected',error.code === 'P0001' ? error.message : 'No se pudo completar la operación en la tienda. Revisa tu acceso e inténtalo de nuevo.')
}
interface ProductRow {
  id: string; sku: string; barcode: string | null; name: string; brands: { name: string };
  category: Category | null; gender: Gender | null; size: number | null; unit: 'ml' | 'oz'; minimum_stock: number; active: boolean;
  product_prices: { tier_code: PriceTier; currency: Currency; amount: number }[];
  inventory_balances: { location: InventoryLocation; quantity: number | null }[]
}
function mapProduct(row: ProductRow): InventoryItem {
  const prices = row.product_prices.map(p=>({tier:p.tier_code,currency:p.currency,amount:Number(p.amount)}))
  const product: Product = { id:row.id,sku:row.sku,barcode:row.barcode ?? row.sku,name:row.name,brand:row.brands.name,
    category:row.category ?? 'unspecified',gender:row.gender ?? 'unspecified',size:row.size === null ? null : Number(row.size),unit:row.unit,
    price:prices.find(p=>p.tier==='emprendedor' && p.currency==='NIO')?.amount ?? 0,currency:'NIO',minimumStock:row.minimum_stock,active:row.active,prices }
  return { product, quantities: { store:row.inventory_balances.find(b=>b.location==='store')?.quantity ?? null,
    warehouse:row.inventory_balances.find(b=>b.location==='warehouse')?.quantity ?? null } }
}
interface DocumentRow {
  id: string; kind: BusinessDocument['kind']; number: string; customer_id: string; customer_name: string; customer_phone: string | null;
  issuer: BusinessDocument['issuer']; currency: Currency; tier_code: PriceTier; total: number; created_at: string; valid_until: string | null;
  payment_method: BusinessDocument['paymentMethod']; notes: string;
  items: {product_id:string;description:string;quantity:number;unit_price:number;line_total:number}[]
}
function mapDocument(row: DocumentRow): BusinessDocument {
  return { id:row.id,kind:row.kind,number:row.number,customerId:row.customer_id,customerName:row.customer_name,customerPhone:row.customer_phone,
    issuer:row.issuer,currency:row.currency,tier:row.tier_code,total:Number(row.total),createdAt:row.created_at,validUntil:row.valid_until,
    paymentMethod:row.payment_method,notes:row.notes,demo:false,items:row.items.map(i=>({productId:i.product_id,description:i.description,
      quantity:i.quantity,unitPrice:Number(i.unit_price),lineTotal:Number(i.line_total)})) }
}
const productSelect='id,sku,barcode,name,category,gender,size,unit,minimum_stock,active,brands(name),product_prices(tier_code,currency,amount),inventory_balances(location,quantity)'
export const supabaseAdapter: DataProvider = {
  mode:'supabase',
  async getInventory() {
    const {data,error}=await client().from('products').select(productSelect).eq('active',true).order('name')
    check(error)
    return (data as unknown as ProductRow[]).map(mapProduct)
  },
  async findByBarcode(code) {
    // Equality queries avoid PostgREST filter injection from arbitrary scanned text.
    let result=await client().from('products').select(productSelect).eq('barcode',code).eq('active',true).maybeSingle()
    check(result.error)
    if (!result.data) result=await client().from('products').select(productSelect).eq('sku',code).eq('active',true).maybeSingle()
    check(result.error)
    return result.data ? mapProduct(result.data as unknown as ProductRow).product : null
  },
  async getTodaySummary() {
    const start=new Date(`${localDate()}T00:00:00-06:00`)
    const end=new Date(start.getTime()+86400000)
    const {data,error,count}=await client().from('documents').select('currency,total',{count:'exact'}).eq('kind','invoice').gte('created_at',start.toISOString()).lt('created_at',end.toISOString())
    check(error)
    return {count:count ?? 0,totals:(data ?? []).reduce((sum,row)=>{sum[row.currency as Currency]+=Number(row.total);return sum},{NIO:0,USD:0})}
  },
  async createInventoryMovement(input) {
    const {error}=await client().rpc('record_inventory_movement',{p_payload:input})
    check(error)
  },
  async getCustomers() {
    const {data,error}=await client().from('customers').select('id,name,phone,price_tier').order('name')
    check(error)
    return (data ?? []).map(row=>({id:row.id,name:row.name,phone:row.phone,priceTier:row.price_tier})) as Customer[]
  },
  async getDocuments(kind) {
    const {data,error}=await client().from('documents').select('id,kind,number,customer_id,customer_name,customer_phone,issuer,currency,tier_code,total,created_at,valid_until,payment_method,notes,items:document_items(product_id,description,quantity,unit_price,line_total)').eq('kind',kind).order('created_at',{ascending:false}).limit(100)
    check(error)
    return (data as unknown as DocumentRow[]).map(mapDocument)
  },
  async createDocument(input) {
    validateDocument(input)
    const {data,error}=await client().rpc('create_document',{p_payload:input})
    check(error)
    return mapDocument(data as DocumentRow)
  },
}
