// Ensayo de la puesta en marcha, contra PostgreSQL de verdad (pglite) con todas
// las migraciones aplicadas. No toca ninguna base desplegada. Reproduce el punto
// de partida del negocio —perfumes con precio, saldos SIN CONTAR y ningún costo—
// y recorre, en orden, lo que el personal va a hacer el día de la entrega.
//
//   node tests/database/puesta-en-marcha.mjs
//
// Sirve para dos cosas: comprobar que el orden correcto sigue funcionando
// después de cualquier cambio, y enseñar por qué el orden importa.
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

const db = new PGlite()
const admin = '11111111-1111-4111-8111-111111111111'
const almacen = '33333333-3333-4333-8333-333333333333'
const ventas = '22222222-2222-4222-8222-222222222222'

const P = {
  conStock: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  conStockB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  agotado: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  correccion: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
}

const id = () => crypto.randomUUID()
async function identidad(uid, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid])
  await db.exec(`set role ${role}`)
}
async function rpc(name, input) {
  return (
    await db.query(`select public.${name}($1::jsonb) as r`, [JSON.stringify(input)])
  ).rows[0].r
}
async function intenta(name, input) {
  try {
    return { ok: true, valor: await rpc(name, input) }
  } catch (e) {
    return { ok: false, error: String(e.message).slice(0, 110) }
  }
}
async function costo(p) {
  const r = (
    await db.query('select average_cost_nio from public.product_costs where product_id=$1', [p])
  ).rows[0]
  return r?.average_cost_nio == null ? null : Number(r.average_cost_nio)
}
async function saldo(p) {
  const r = await db.query(
    'select location,quantity from public.inventory_balances where product_id=$1 order by location',
    [p],
  )
  return r.rows.map((x) => `${x.location}=${x.quantity === null ? 'SIN CONTAR' : x.quantity}`).join(' ')
}
const contar = (productId, location, cantidad) => ({
  requestId: id(), productId, location, type: 'ADJUSTMENT', quantity: cantidad,
  note: 'Conteo inicial de existencias',
})
const costoInicial = (productId, unitCost) => ({
  requestId: id(), productId, unitCost, currency: 'NIO', exchangeRate: 1,
  note: 'Costo de la factura original del proveedor',
})
const pedido = (lineas, envio = 450) => ({
  requestId: id(), incurredOn: '2026-09-15', supplier: 'Proveedor', agency: 'Agencia',
  reference: 'PED-001', note: '', currency: 'NIO', exchangeRate: 1,
  shippingAmount: envio, lines: lineas,
})

const titulo = (t) => console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`)

try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`)
  await db.query('insert into auth.users(id) values($1),($2),($3)', [admin, almacen, ventas])
  for (const f of (await readdir('supabase/migrations')).sort())
    if (f.endsWith('.sql') && !f.includes('harden_platform_function_grants'))
      await db.exec(await readFile(`supabase/migrations/${f}`, 'utf8'))
  await db.query(
    "insert into public.staff_members(user_id,display_name,role) values($1,'Dueño','admin'),($2,'Bodega','warehouse'),($3,'Vendedor','operator')",
    [admin, almacen, ventas],
  )
  await db.exec(
    "insert into public.business_settings(name) values('La Casa del Perfume'); insert into public.brands(name) values('Marca');",
  )
  // Estado de hoy: precio cargado, saldo SIN CONTAR, sin costo.
  for (const p of Object.values(P)) {
    await db.query(
      "insert into public.products(id,sku,name,brand_id) values($1::uuid,$1::text,'Perfume',(select id from public.brands limit 1))",
      [p],
    )
    await db.query(
      "insert into public.product_prices(product_id,tier_code,currency,amount) values($1,'emprendedor','NIO',7844),($1,'emprendedor','USD',212)",
      [p],
    )
    await db.query(
      "insert into public.inventory_balances(product_id,location,quantity) values($1,'store',null),($1,'warehouse',null)",
      [p],
    )
  }

  titulo('PUNTO DE PARTIDA (igual al de hoy)')
  console.log('saldo:', await saldo(P.conStock), '| costo promedio:', await costo(P.conStock))

  titulo('1. ¿Puede el rol Inventario registrar el conteo?')
  await identidad(almacen)
  const r1 = await intenta('record_inventory_movement', contar(P.conStock, 'store', 20))
  console.log('Inventario cuenta tienda=20 →', r1.ok ? 'SÍ PUEDE' : 'RECHAZADO: ' + r1.error)
  const r1b = await intenta('record_inventory_movement', contar(P.conStock, 'warehouse', 5))
  console.log('Inventario cuenta bodega=5  →', r1b.ok ? 'SÍ PUEDE' : 'RECHAZADO: ' + r1b.error)
  console.log('saldo ahora:', await saldo(P.conStock), '| costo promedio:', await costo(P.conStock))

  titulo('2. ¿Puede Ventas facturar un perfume sin costo conocido?')
  await identidad(ventas)
  const venta = await intenta('create_document', {
    requestId: id(), kind: 'invoice', customerName: 'Cliente', tier: 'emprendedor',
    currency: 'NIO', location: 'store', paymentMethod: 'cash', notes: '', taxRate: 0,
    items: [{ productId: P.conStock, quantity: 1 }],
  })
  console.log('Ventas emite factura →', venta.ok ? 'SÍ PUEDE' : 'RECHAZADO: ' + venta.error)
  await db.exec('reset role')
  const snap = (await db.query('select unit_cost_nio,net_revenue_nio from public.document_item_costs')).rows[0]
  console.log('costo congelado en la factura:', snap?.unit_cost_nio, '| venta neta:', snap?.net_revenue_nio)
  console.log('  → la venta entra, pero SIN costo: el margen de esa factura queda en blanco para siempre.')

  titulo('3. CAMINO A — cargar el costo inicial ANTES del primer pedido')
  await identidad(admin)
  const a1 = await intenta('set_opening_cost', costoInicial(P.conStock, 300))
  console.log('costo inicial 300 →', a1.ok ? 'aceptado' : 'RECHAZADO: ' + a1.error, '| promedio:', await costo(P.conStock))
  const a2 = await intenta('record_shipment', pedido([{ productId: P.conStock, location: 'warehouse', quantity: 30, unitPrice: 310 }], 450))
  console.log('pedido 30 uds a 310 + envío 450 →', a2.ok ? 'aceptado' : 'RECHAZADO: ' + a2.error)
  console.log('promedio ponderado:', await costo(P.conStock), '| saldo:', await saldo(P.conStock))
  console.log('  → esperado: (300×24 + 325×30) / 54 = ' + ((300 * 24 + 325 * 30) / 54).toFixed(6))

  titulo('4. CAMINO B — contar y recibir el pedido SIN cargar costo inicial')
  await identidad(almacen)
  await rpc('record_inventory_movement', contar(P.conStockB, 'store', 20))
  await rpc('record_inventory_movement', contar(P.conStockB, 'warehouse', 5))
  await identidad(admin)
  console.log('contado:', await saldo(P.conStockB), '| costo antes del pedido:', await costo(P.conStockB))
  const b1 = await intenta('record_shipment', pedido([{ productId: P.conStockB, location: 'warehouse', quantity: 30, unitPrice: 310 }], 450))
  console.log('pedido 30 uds a 310 + envío 450 →', b1.ok ? 'ACEPTADO' : 'rechazado: ' + b1.error)
  console.log('costo DESPUÉS del pedido:', await costo(P.conStockB))
  await db.exec('reset role')
  const linea = (await db.query('select landed_unit_cost_nio from public.purchase_shipment_lines where product_id=$1', [P.conStockB])).rows[0]
  await identidad(admin)
  console.log('costo puesto que SÍ quedó registrado en el renglón del pedido:', linea?.landed_unit_cost_nio)
  console.log('  → el pedido se guarda con su costo, pero el promedio del producto queda en NULO.')

  titulo('5. ¿Se puede reparar después? ¿A qué precio queda?')
  const rep = await intenta('set_opening_cost', costoInicial(P.conStockB, 300))
  console.log('costo inicial 300 después del pedido →', rep.ok ? 'aceptado' : 'RECHAZADO: ' + rep.error)
  await db.exec('reset role')
  const unidades = (await db.query('select quantity from public.opening_cost_records where product_id=$1', [P.conStockB])).rows[0]?.quantity
  await identidad(admin)
  console.log('promedio resultante:', await costo(P.conStockB), '| unidades que abarca:', unidades)
  console.log('  → las 30 unidades que llegaron a 325 quedan valoradas a 300. El costo del pedido se pierde.')

  titulo('6. Perfume contado en CERO: ¿el pedido establece bien el costo?')
  await identidad(almacen)
  await rpc('record_inventory_movement', contar(P.agotado, 'store', 0))
  await rpc('record_inventory_movement', contar(P.agotado, 'warehouse', 0))
  await identidad(admin)
  const c0 = await intenta('set_opening_cost', costoInicial(P.agotado, 300))
  console.log('costo inicial con existencia 0 →', c0.ok ? 'aceptado' : 'RECHAZADO: ' + c0.error)
  const c1 = await intenta('record_shipment', pedido([{ productId: P.agotado, location: 'warehouse', quantity: 30, unitPrice: 310 }], 450))
  console.log('pedido 30 uds a 310 + envío 450 →', c1.ok ? 'aceptado' : 'rechazado: ' + c1.error)
  console.log('costo promedio:', await costo(P.agotado), '  → esperado 310 + 450/30 = 325')

  titulo('7. Corregir un conteo HACIA ARRIBA después de tener costo')
  await identidad(almacen)
  await rpc('record_inventory_movement', contar(P.correccion, 'store', 10))
  await rpc('record_inventory_movement', contar(P.correccion, 'warehouse', 0))
  await identidad(admin)
  await rpc('set_opening_cost', costoInicial(P.correccion, 300))
  console.log('costo cargado:', await costo(P.correccion), '| saldo:', await saldo(P.correccion))
  await identidad(almacen)
  await rpc('record_inventory_movement', contar(P.correccion, 'store', 12))
  await identidad(admin)
  console.log('tras corregir el conteo de 10 a 12 → costo promedio:', await costo(P.correccion))
  const rep2 = await intenta('set_opening_cost', costoInicial(P.correccion, 300))
  console.log('¿se puede volver a cargar? →', rep2.ok ? 'sí, queda en ' + (await costo(P.correccion)) : 'NO: ' + rep2.error)

  titulo('8. Corregir un conteo HACIA ABAJO después de tener costo')
  await identidad(almacen)
  await rpc('record_inventory_movement', contar(P.correccion, 'store', 9))
  await identidad(admin)
  console.log('tras corregir el conteo de 12 a 9 → costo promedio:', await costo(P.correccion))

  console.log('\n' + '═'.repeat(72))
  console.log('Ensayo terminado. No se tocó ninguna base desplegada.')
  console.log('═'.repeat(72))
} finally {
  await db.close()
}
