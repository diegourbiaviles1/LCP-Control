import type { InventoryItem, Product, BusinessDocument, Customer } from '../../lib/domain'
import type { DataProvider } from '../contracts'
import { AppError } from '../../lib/errors'
import { localDate, priceFor, validateDocument } from '../../features/sales/documents'
// Generic fixtures are isolated from Supabase and reset on reload.
const specifications = [
  ['A', 'arabian', 'unisex', 18, 12, 10, 1250],
  ['B', 'designer', 'female', 2, 1, 8, 1800],
  ['C', 'arabian', 'male', 24, 16, 12, 1450],
  ['D', 'designer', 'unisex', 0, 0, 6, 2100],
  ['E', 'arabian', 'female', 14, 8, 10, 1350],
  ['F', 'designer', 'male', 4, 2, 8, 1950],
  ['G', 'arabian', 'unisex', 20, 11, 10, 1500],
  ['H', 'designer', 'female', 9, 6, 8, 1700],
] as const
export function createDemoAdapter(): DataProvider {
const items: InventoryItem[] = specifications.map(
  (
    [letter, category, gender, warehouse, store, minimumStock, price],
    index,
  ) => ({
    product: {
      id: `demo-${letter.toLowerCase()}`,
      barcode: `LCP-${String(index + 1).padStart(4, '0')}`,
      name: `Producto ${letter}`,
      brand: 'Marca',
      category,
      gender,
      size: 100,
      unit: 'ml',
      price,
      currency: 'NIO',
      minimumStock,
      active: true,
      prices: (['emprendedor','vip','premium'] as const).flatMap((tier,i)=>[
        {tier,currency:'NIO' as const,amount:price-i*100},
        {tier,currency:'USD' as const,amount:Math.round((price-i*100)/37*100)/100},
      ]),
    } satisfies Product,
    quantities: { warehouse, store },
  }),
)
const documents: BusinessDocument[] = []
const requests = new Map<string,{input:string;document:BusinessDocument}>()
const customers: Customer[] = [
 {id:'demo-client-1',name:'Cliente de ejemplo',phone:null,priceTier:'emprendedor'},
 {id:'demo-client-2',name:'Cliente VIP de ejemplo',phone:null,priceTier:'vip'},
 {id:'demo-client-3',name:'Cliente Premium de ejemplo',phone:null,priceTier:'premium'},
]
return {
 mode:'demo',
 async getInventory() { return structuredClone(items) },
 async findByBarcode(code) { return structuredClone(items.find(i=>i.product.barcode===code)?.product ?? null) },
 async getTodaySummary() {
  const sales=documents.filter(d=>d.kind==='invoice' && localDate(new Date(d.createdAt))===localDate())
  return {count:sales.length,totals:sales.reduce((sum,d)=>{sum[d.currency]+=d.total;return sum},{NIO:0,USD:0})}
 },
 async createInventoryMovement() {
  throw new AppError('configuration','Los movimientos de inventario requieren una cuenta de la tienda. La demo no guarda movimientos reales.')
 },
 async getCustomers() { return structuredClone(customers) },
 async getDocuments(kind) { return structuredClone(documents.filter(d=>d.kind===kind).reverse()) },
 async createDocument(input) {
  validateDocument(input)
  const existing=requests.get(input.requestId)
  if(existing) {
   if(existing.input!==JSON.stringify(input)) throw new AppError('validation','La operación ya existe con otros datos.')
   return structuredClone(existing.document)
  }
  const selected=customers.find(c=>c.id===input.customerId)
  if(input.customerId && !selected) throw new AppError('validation','Cliente no encontrado.')
  if(input.tier !== (selected?.priceTier ?? 'emprendedor')) throw new AppError('unauthorized','Usa la lista asignada al cliente por un dueño.')
  const lines=input.items.map(line=>{
   const item=items.find(i=>i.product.id===line.productId)
   if(!item) throw new AppError('validation','Producto no encontrado.')
   const price=priceFor(item.product,input.tier,input.currency)
   if(price===null) throw new AppError('validation','No hay precio en esta moneda.')
   if(input.kind==='invoice') {
    const stock=input.location ? item.quantities[input.location] : null
    if(stock===null || stock<line.quantity) throw new AppError('validation','Existencias insuficientes para '+item.product.name)
   }
   return {productId:item.product.id,description:item.product.name+' · '+item.product.size+' '+item.product.unit,
    quantity:line.quantity,unitPrice:price,lineTotal:Math.round(price*100)*line.quantity/100}
  })
  const customer=selected ?? {id:crypto.randomUUID(),name:input.customerName.trim(),phone:input.customerPhone||null,priceTier:input.tier}
  if(!selected) customers.push(customer)
  const doc: BusinessDocument={
   id:crypto.randomUUID(),kind:input.kind,number:(input.kind==='invoice'?'DEMO-FAC-':'DEMO-PRO-')+String(documents.filter(d=>d.kind===input.kind).length+1).padStart(6,'0'),
   customerId:customer.id,customerName:customer.name,customerPhone:customer.phone,
   issuer:{name:'LCP Control · Demostración',address:'',phone:''},currency:input.currency,tier:input.tier,
   total:lines.reduce((sum,i)=>sum+Math.round(i.lineTotal*100),0)/100,createdAt:new Date().toISOString(),
   validUntil:input.kind==='proforma'?input.validUntil:null,paymentMethod:input.kind==='invoice'?input.paymentMethod:null,notes:input.notes,demo:true,items:lines,
  }
  if(input.kind==='invoice' && input.location) for(const line of input.items) {
   const item=items.find(i=>i.product.id===line.productId)!
   item.quantities[input.location]=item.quantities[input.location]!-line.quantity
  }
  documents.push(doc)
  requests.set(input.requestId,{input:JSON.stringify(input),document:doc})
  return structuredClone(doc)
 }
}
}
export const demoAdapter=createDemoAdapter()
