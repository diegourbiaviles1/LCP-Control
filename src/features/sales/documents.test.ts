import { describe, expect, it } from 'vitest'
import { createDemoAdapter } from '../../services/adapters/demo'
import { documentText, normalizePhone, whatsappUrl } from './documents'
import type { DocumentInput } from '../../lib/domain'
const quote = ():DocumentInput=>({requestId:crypto.randomUUID(),kind:'proforma',customerId:null,customerName:'Cliente prueba',customerPhone:'',currency:'NIO',tier:'emprendedor',location:null,validUntil:'2099-12-31',paymentMethod:null,notes:'Consulta por regalo',items:[{productId:'demo-a',quantity:2}]})
describe('document separation and sharing',()=>{
 it('normalizes Nicaragua and international phone numbers, rejecting invalid destinations',()=>{
  expect(normalizePhone('8888-0000')).toBe('50588880000')
  expect(normalizePhone('+1 (212) 555-1234')).toBe('12125551234')
  expect(()=>normalizePhone('8888<script>')).toThrow()
  expect(()=>normalizePhone('')).toThrow()
 })
 it('saves a quotation without touching stock or sales and labels every WhatsApp message',async()=>{
  const adapter=createDemoAdapter()
  const before=await adapter.getInventory()
  const doc=await adapter.createDocument(quote())
  expect(doc.number).toMatch(/^DEMO-PRO-/)
  expect(doc.total).toBe(2500)
  expect(await adapter.getInventory()).toEqual(before)
  expect((await adapter.getTodaySummary()).count).toBe(0)
  expect(await adapter.getDocuments('invoice')).toEqual([])
  const text=documentText(doc)
  expect(text).toContain('PROFORMA / COTIZACIÓN')
  expect(text).toContain('no es una factura')
  expect(text).toContain('SIN VALIDEZ COMERCIAL')
  const url=new URL(whatsappUrl(doc,'88880000'))
  expect(url.hostname).toBe('wa.me')
  expect(url.searchParams.get('text')).toBe(text)
 })
 it('uses exact tier and currency prices, preserving assigned owner list',async()=>{
  const adapter=createDemoAdapter()
  const doc=await adapter.createDocument({...quote(),customerId:'demo-client-3',tier:'premium',currency:'USD'})
  expect(doc.total).toBe(56.76)
  await expect(adapter.createDocument({...quote(),tier:'premium'})).rejects.toThrow('lista asignada')
 })
 it('deducts invoice stock once, keeps totals separate and rejects conflicting retries',async()=>{
  const adapter=createDemoAdapter()
  const input={...quote(),kind:'invoice' as const,location:'store' as const,validUntil:null,paymentMethod:'pending' as const}
  const doc=await adapter.createDocument(input)
  expect((await adapter.createDocument(input)).id).toBe(doc.id)
  expect((await adapter.getInventory())[0].quantities.store).toBe(10)
  expect((await adapter.getTodaySummary()).count).toBe(1)
  expect(await adapter.getDocuments('proforma')).toEqual([])
  expect(documentText(doc)).toContain('FACTURA DEMO-FAC-')
  expect(documentText(doc)).not.toContain('PROFORMA')
  expect(documentText(doc)).toContain('Pago pendiente')
  await expect(adapter.createDocument({...input,notes:'change'})).rejects.toThrow('otros datos')
 })
 it('rejects insufficient stock atomically and invalid or duplicate line quantities',async()=>{
  const adapter=createDemoAdapter()
  const before=await adapter.getInventory()
  const invoice={...quote(),kind:'invoice' as const,location:'store' as const,validUntil:null,paymentMethod:'cash' as const}
  await expect(adapter.createDocument({...invoice,items:[{productId:'demo-a',quantity:1},{productId:'demo-d',quantity:1}]})).rejects.toThrow('insuficientes')
  expect(await adapter.getInventory()).toEqual(before)
  for(const quantity of [0,-1,1.5,NaN,10001]) await expect(adapter.createDocument({...quote(),items:[{productId:'demo-a',quantity}]})).rejects.toThrow()
  await expect(adapter.createDocument({...quote(),items:[{productId:'demo-a',quantity:1},{productId:'demo-a',quantity:1}]})).rejects.toThrow('repitas')
  await expect(adapter.createDocument({...quote(),validUntil:'2020-01-01'})).rejects.toThrow('vigencia')
 })
})
