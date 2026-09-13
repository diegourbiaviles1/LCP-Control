// PostgreSQL WASM integration test. Install @electric-sql/pglite in .tools/db-tests.
import { PGlite } from '../.tools/db-tests/node_modules/@electric-sql/pglite/dist/index.js'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import console from 'node:console'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
await db.exec(await fs.readFile('supabase/migrations/20260912232622_business_catalog_documents.sql','utf8'))
const importSQL = await fs.readFile('output/database-discovery/catalog-import.sql','utf8')
await db.exec(importSQL)
await db.exec(importSQL) // re-import is idempotent
const scalar = async (sql, args=[]) => Object.values((await db.query(sql,args)).rows[0])[0]
assert.equal(await scalar('select count(*)::int from public.products'),260)
assert.equal(await scalar('select count(*)::int from public.product_prices'),1560)
assert.equal(await scalar('select count(*)::int from private.import_rows'),780)
assert.equal(await scalar('select count(*)::int from public.inventory_balances where quantity is null'),520)
assert.equal(await scalar('select count(*)::int from public.products where size is null and size_needs_review'),4)
const source = JSON.parse(await fs.readFile('output/database-discovery/catalog.json','utf8'))
const prices = (await db.query('select p.import_key,pp.tier_code,pp.currency,pp.amount from public.products p join public.product_prices pp on p.id=pp.product_id')).rows
for (const price of prices) assert.equal(Number(price.amount),Number(source.find(p=>p.key===price.import_key).prices[price.tier_code][price.currency]))
const admin=randomUUID(), operator=randomUUID(), stranger=randomUUID()
await db.query('insert into auth.users values ($1),($2),($3)',[admin,operator,stranger])
await db.query("insert into public.staff_members values($1,'Test owner','admin',true),($2,'Test operator','operator',true)",[admin,operator])
const product=await scalar("select id from public.products where sku='LCP-0001'")
const other=await scalar("select id from public.products where sku='LCP-0002'")
async function asUser(uid, fn) {
 await db.exec('set role authenticated')
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
 try { return await fn() } finally { await db.exec('reset role') }
}
const rpc = p => scalar('select public.create_document($1::jsonb)',[JSON.stringify(p)])
const move = p => scalar('select public.record_inventory_movement($1::jsonb)',[JSON.stringify(p)])
const base={kind:'proforma',currency:'NIO',tier:'emprendedor',customerName:'Cliente prueba',customerPhone:'',validUntil:'2099-12-31',notes:'',items:[{productId:product,quantity:2}]}
await db.exec('set role anon')
await assert.rejects(db.query('select * from public.products'),/permission denied/)
await assert.rejects(rpc({...base,requestId:randomUUID()}),/permission denied/)
await db.exec('reset role')
await asUser(stranger,async()=>{
 assert.equal(await scalar('select count(*)::int from public.products'),0)
 await assert.rejects(rpc({...base,requestId:randomUUID()}),/Acceso no autorizado/)
})
await asUser(operator,async()=>{
 await assert.rejects(db.query("update public.inventory_balances set quantity=999"),/permission denied/)
 await assert.rejects(db.query("update public.staff_members set role='admin'"),/permission denied/)
 await assert.rejects(rpc({...base,tier:'premium',requestId:randomUUID()}),/dueño debe asignar/)
 await assert.rejects(move({productId:product,location:'store',type:'ADJUSTMENT',quantity:10,note:'count',requestId:randomUUID()}),/Solo un dueño/)
})
await asUser(admin,async()=>{
 const payload={...base,requestId:randomUUID()}
 const quote=await rpc(payload)
 assert.match(quote.number,/^PRO-/)
 assert.equal(Number(quote.total),2590)
 assert.equal(await scalar('select count(*)::int from public.inventory_movements'),0)
 assert.equal((await rpc(payload)).id,quote.id)
 await assert.rejects(rpc({...payload,notes:'changed'}),/otros datos/)
 const invoice={...base,kind:'invoice',validUntil:null,location:'store',paymentMethod:'pending',requestId:randomUUID()}
 await assert.rejects(rpc(invoice),/conteo de inventario/)
 const count={productId:product,location:'store',type:'ADJUSTMENT',quantity:5,note:'Initial count',requestId:randomUUID()}
 const mid=await move(count)
 assert.equal(await move(count),mid)
 await assert.rejects(move({...count,quantity:9}),/otros datos/)
 await assert.rejects(rpc({...invoice,items:[{productId:product,quantity:6}]}),/insuficientes/)
 await assert.rejects(rpc({...invoice,items:[{productId:product,quantity:1},{productId:other,quantity:1}]}),/conteo de inventario/)
 assert.equal(await scalar("select quantity from public.inventory_balances where product_id=$1 and location='store'",[product]),5)
 const sale=await rpc(invoice)
 assert.match(sale.number,/^FAC-/)
 assert.equal((await rpc(invoice)).id,sale.id)
 assert.equal(await scalar("select quantity from public.inventory_balances where product_id=$1 and location='store'",[product]),3)
 assert.equal(await scalar("select count(*)::int from public.inventory_movements where type='SALE'"),1)
 await assert.rejects(rpc({...invoice,requestId:randomUUID(),items:[{productId:product,quantity:1.5}]}),/entera/)
 await assert.rejects(rpc({...invoice,requestId:randomUUID(),items:[{productId:product,quantity:1},{productId:product,quantity:1}]}),/repitas/)
 const premium=await rpc({...base,tier:'premium',customerName:'Premium client',requestId:randomUUID()})
 const opQuote=await asUser(operator,()=>rpc({...base,tier:'premium',customerId:premium.customer_id,requestId:randomUUID()}))
 assert.equal(Number(opQuote.total),2220)
})
await db.close()
console.log('PASS: schema, idempotent import, 1560 prices, NULL stock, RLS, owner-only tiers, invoice atomicity, quote isolation, idempotent documents and movements, invalid quantities.')
