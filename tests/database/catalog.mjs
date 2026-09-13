// Disposable PostgreSQL engine; auth/storage stubs model Supabase's platform
// schemas. This never connects to a network or a deployed database.
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
const admin = '11111111-1111-4111-8111-111111111111'
const operator = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let checks = 0
async function check(name, action) {
  await action()
  checks++
  console.log(`OK ${name}`)
}
async function identity(uid, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid])
  await db.exec(`set role ${role}`)
}
const save = (value) =>
  db.query('select public.save_catalog_product($1::jsonb) as id', [
    JSON.stringify(value),
  ])
const remove = (pid, revision) =>
  db.query(
    'select public.remove_catalog_product($1::uuid,$2::integer) as result',
    [pid, revision],
  )
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
  `)
  for (const file of [
    '20260912233508_business_catalog_documents.sql',
    '20260913031957_role_scoped_reads_and_closed_defaults.sql',
    '20260913032121_per_user_rate_limits.sql',
    '20260913120000_catalog_management_and_images.sql',
  ]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  }
  await db.query('insert into auth.users(id) values($1),($2),($3)', [
    admin,
    operator,
    outsider,
  ])
  await db.query(
    "insert into public.staff_members(user_id,display_name,role) values($1,'Admin','admin'),($2,'Operador','operator')",
    [admin, operator],
  )
  await db.exec(
    "insert into public.business_settings(name) values('Negocio de prueba')",
  )
  const product = {
    id,
    revision: 0,
    name: 'Perfume inicial',
    brand: 'Marca de prueba',
    size: 100,
    unit: 'ml',
    category: 'niche',
    gender: 'unisex',
    manufacturerBarcode: '1234567890123',
    minimumStock: 2,
    active: true,
    imagePath: null,
    prices: {
      emprendedor: { NIO: 1200, USD: 35 },
      vip: { NIO: 1100, USD: 32 },
      premium: { NIO: 1000, USD: 29 },
    },
  }
  await identity(admin)
  await check(
    'admin creates product and six prices, with uncounted balances',
    async () => {
      assert.equal((await save(product)).rows[0].id, id)
      assert.equal(
        (await db.query('select * from public.product_prices')).rows.length,
        6,
      )
      assert.deepEqual(
        (
          await db.query('select quantity from public.inventory_balances')
        ).rows.map((r) => r.quantity),
        [null, null],
      )
    },
  )
  await check('invalid price rolls back all product changes', async () => {
    const wrong = structuredClone(product)
    wrong.revision = 1
    wrong.name = 'No debe guardarse'
    wrong.prices.vip.USD = -1
    await assert.rejects(save(wrong), /precios/)
    assert.equal(
      (await db.query('select name from public.products')).rows[0].name,
      product.name,
    )
  })
  await check('optimistic revision rejects stale changes', async () => {
    await save({ ...product, revision: 1, name: 'Perfume editado' })
    await assert.rejects(save({ ...product, revision: 1 }), /Otro usuario/)
  })
  await check(
    'duplicate manufacturer code does not create a second product',
    async () => {
      await assert.rejects(
        save({ ...product, id: crypto.randomUUID() }),
        /código/,
      )
      assert.equal(
        (await db.query('select * from public.products')).rows.length,
        1,
      )
    },
  )
  await identity(operator)
  await check('operator cannot save or delete products', async () => {
    await assert.rejects(
      save({ ...product, revision: 2 }),
      /insufficient_privilege/,
    )
    await assert.rejects(remove(id, 2), /insufficient_privilege/)
  })
  await identity(outsider)
  await check(
    'unregistered account cannot read products or write',
    async () => {
      assert.equal(
        (await db.query('select * from public.products')).rows.length,
        0,
      )
      await assert.rejects(save(product), /insufficient_privilege/)
    },
  )
  await identity('', 'anon')
  await check('anonymous account cannot invoke product RPC', async () => {
    await assert.rejects(save(product), /permission denied/)
  })
  await identity(admin)
  const path = `${admin}/test.webp`
  await check(
    'admin uploads within own folder and associates only existing image',
    async () => {
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('product-images',$1)",
          [`${operator}/bad.webp`],
        ),
        /row-level security/,
      )
      await assert.rejects(
        save({ ...product, revision: 2, imagePath: path }),
        /imagen/,
      )
      await db.query(
        "insert into storage.objects(bucket_id,name) values('product-images',$1)",
        [path],
      )
      await save({ ...product, revision: 2, imagePath: path })
      await db.query('delete from storage.objects where name=$1', [path])
      assert.equal(
        (await db.query('select * from storage.objects')).rows.length,
        1,
      )
    },
  )
  await identity(operator)
  await check('operator reads stored images but cannot upload', async () => {
    assert.equal(
      (await db.query('select * from storage.objects')).rows.length,
      1,
    )
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('product-images',$1)",
        [`${operator}/bad.webp`],
      ),
      /row-level security/,
    )
  })
  await identity(admin)
  let documentId
  await check(
    'proforma preserves description and prices after catalogue edit',
    async () => {
      const result = await db.query(
        'select public.create_document($1::jsonb) as doc',
        [
          JSON.stringify({
            requestId: crypto.randomUUID(),
            kind: 'proforma',
            customerName: 'Cliente prueba',
            tier: 'emprendedor',
            currency: 'NIO',
            validUntil: '2099-01-01',
            notes: '',
            items: [{ productId: id, quantity: 1 }],
          }),
        ],
      )
      documentId = result.rows[0].doc.id
      await save({ ...product, revision: 3, name: 'Otro nombre' })
      const snapshot = (
        await db.query(
          'select description,unit_price from public.document_items where document_id=$1',
          [documentId],
        )
      ).rows[0]
      assert.match(snapshot.description, /Perfume inicial/)
      assert.equal(Number(snapshot.unit_price), 1200)
    },
  )
  await check(
    'product with history is archived, then can be restored',
    async () => {
      assert.equal((await remove(id, 4)).rows[0].result, 'archived')
      await save({ ...product, revision: 5, active: true })
      assert.equal(
        (await db.query('select active from public.products where id=$1', [id]))
          .rows[0].active,
        true,
      )
    },
  )
  await check('never-used product is deleted', async () => {
    const fresh = {
      ...product,
      id: crypto.randomUUID(),
      manufacturerBarcode: '',
    }
    await save(fresh)
    assert.equal((await remove(fresh.id, 1)).rows[0].result, 'deleted')
  })
  await check(
    'stock blocks retirement and catalogue never changes balances',
    async () => {
      await db.query('select public.record_inventory_movement($1::jsonb)', [
        JSON.stringify({
          requestId: crypto.randomUUID(),
          productId: id,
          type: 'ADJUSTMENT',
          location: 'store',
          quantity: 3,
          note: 'Conteo de prueba',
        }),
      ])
      await assert.rejects(remove(id, 6), /existencias/)
      await assert.rejects(
        save({ ...product, revision: 6, active: false }),
        /existencias/,
      )
      assert.equal(
        (
          await db.query(
            "select quantity from public.inventory_balances where product_id=$1 and location='store'",
            [id],
          )
        ).rows[0].quantity,
        3,
      )
    },
  )
  await check('profile update changes only own name, not role', async () => {
    await db.query('select public.update_my_profile($1)', ['Nombre nuevo'])
    const row = (
      await db.query(
        'select display_name,role from public.staff_members where user_id=$1',
        [admin],
      )
    ).rows[0]
    assert.deepEqual(row, { display_name: 'Nombre nuevo', role: 'admin' })
  })
  await identity(admin)
  await db.exec('reset role; alter table auth.users add column email text;')
  await db.exec(
    await readFile(
      'supabase/migrations/20260914010000_complete_workspace.sql',
      'utf8',
    ),
  )
  await db.exec(
    "insert into private.pending_staff(email,display_name,role) values('viewer@example.invalid','Viewer','viewer'),('warehouse@example.invalid','Warehouse','warehouse');",
  )
  const viewer = '44444444-4444-4444-8444-444444444444'
  const warehouse = '55555555-5555-4555-8555-555555555555'
  await check('only authorized emails can activate accounts', async () => {
    await assert.rejects(
      db.query(
        "insert into auth.users(id,email) values(gen_random_uuid(),'outsider@example.invalid')",
      ),
      /Cuenta no autorizada/,
    )
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      viewer,
      'viewer@example.invalid',
      warehouse,
      'warehouse@example.invalid',
    ])
  })
  await identity(viewer)
  await check(
    'viewer reads stock but cannot sell or change stock',
    async () => {
      assert.ok((await db.query('select * from public.products')).rows.length)
      await assert.rejects(db.query("select public.create_document('{}')"))
      await assert.rejects(
        db.query("select public.record_inventory_movement('{}')"),
      )
      await assert.rejects(db.query('select public.list_staff_accounts()'))
      assert.equal(
        (await db.query('select * from public.customers')).rows.length,
        0,
      )
    },
  )
  await identity(admin)
  await check('customer updates require matching revisions', async () => {
    const c = {
      id: crypto.randomUUID(),
      revision: 0,
      name: 'Cliente',
      phone: '50588881111',
      priceTier: 'vip',
      active: true,
    }
    await db.query('select public.save_customer($1)', [JSON.stringify(c)])
    await assert.rejects(
      db.query('select public.save_customer($1)', [JSON.stringify(c)]),
      /Otro usuario/,
    )
  })
  await check('supplier persists and operator cannot write it', async () => {
    await db.query('select public.save_supplier($1)', [
      JSON.stringify({
        id: crypto.randomUUID(),
        revision: 0,
        name: 'Proveedor',
        active: true,
      }),
    ])
    assert.equal(
      (await db.query('select * from public.suppliers')).rows.length,
      1,
    )
    await identity(operator)
    await assert.rejects(db.query("select public.save_supplier('{}')"))
    assert.equal(
      (await db.query('select * from public.suppliers')).rows.length,
      0,
    )
  })
  await check(
    'drafts are private and conflicting saves are rejected',
    async () => {
      await db.query(
        "select public.save_my_drafts('lcp.drafts.invoice.v2','[]',0)",
      )
      await assert.rejects(
        db.query(
          "select public.save_my_drafts('lcp.drafts.invoice.v2','[]',0)",
        ),
        /otro equipo/,
      )
      await identity(admin)
      assert.equal(
        (await db.query('select * from public.user_drafts')).rows.length,
        0,
      )
    },
  )
  await check(
    'administrator cannot grant superadmin or disable himself',
    async () => {
      await assert.rejects(
        db.query(
          "select public.save_staff_account('person@example.invalid','Persona','superadmin',true)",
        ),
      )
      await db.exec('reset role')
      await db.query('update auth.users set email=$1 where id=$2', [
        'admin@example.invalid',
        admin,
      ])
      await identity(admin)
      await assert.rejects(
        db.query(
          "select public.save_staff_account('admin@example.invalid','Admin','viewer',true)",
        ),
        /propios permisos/,
      )
    },
  )
  await db.exec('reset role')
  await db.exec(
    await readFile(
      'supabase/migrations/20260914011000_warehouse_history.sql',
      'utf8',
    ),
  )
  await identity(warehouse)
  await check(
    'warehouse counts inventory and reads only its own movement history',
    async () => {
      const result = await db.query(
        'select public.record_inventory_movement($1::jsonb) as id',
        [
          JSON.stringify({
            requestId: crypto.randomUUID(),
            productId: id,
            type: 'ADJUSTMENT',
            location: 'warehouse',
            quantity: 7,
            note: 'Conteo físico de prueba',
          }),
        ],
      )
      const history = await db.query(
        'select id,after_quantity from public.inventory_movements',
      )
      assert.equal(history.rows.length, 1)
      assert.equal(history.rows[0].id, result.rows[0].id)
      assert.equal(history.rows[0].after_quantity, 7)
      await assert.rejects(db.query("select public.create_document('{}')"))
    },
  )
  await identity(admin)
  await check(
    'customer tax ID and original business details survive later edits',
    async () => {
      const customerId = crypto.randomUUID()
      await db.query('select public.save_customer($1)', [
        JSON.stringify({
          id: customerId,
          revision: 0,
          name: 'Cliente con RUC',
          priceTier: 'emprendedor',
          taxId: 'RUC-DE-PRUEBA',
          active: true,
        }),
      ])
      const payload = {
        requestId: crypto.randomUUID(),
        kind: 'proforma',
        customerId,
        tier: 'emprendedor',
        currency: 'NIO',
        validUntil: '2099-01-01',
        notes: 'Prueba',
        items: [{ productId: id, quantity: 1 }],
      }
      const result = await db.query(
        'select public.create_document($1::jsonb) as document',
        [JSON.stringify(payload)],
      )
      const doc = result.rows[0].document
      const stored = (
        await db.query(
          'select customer_tax_id,issuer from public.documents where id=$1',
          [doc.id],
        )
      ).rows[0]
      assert.equal(stored.customer_tax_id, 'RUC-DE-PRUEBA')
      await db.query(
        "select public.save_business_settings('Nombre actualizado','','')",
      )
      assert.deepEqual(
        (
          await db.query('select issuer from public.documents where id=$1', [
            doc.id,
          ])
        ).rows[0].issuer,
        stored.issuer,
      )
    },
  )
  await db.exec('reset role')
  await db.exec(
    await readFile(
      'supabase/migrations/20260914012000_document_customer_details.sql',
      'utf8',
    ),
  )
  await identity(admin)
  await check(
    'document-created customers retain tax ID and tier edits invalidate stale revisions',
    async () => {
      const payload = {
        requestId: crypto.randomUUID(),
        kind: 'proforma',
        customerName: 'Nuevo desde proforma',
        customerTaxId: 'RUC-NUEVO',
        tier: 'emprendedor',
        currency: 'USD',
        validUntil: '2099-01-01',
        notes: 'Prueba',
        items: [{ productId: id, quantity: 1 }],
      }
      await db.query('select public.create_document($1::jsonb)', [
        JSON.stringify(payload),
      ])
      const customer = (
        await db.query(
          "select * from public.customers where name='Nuevo desde proforma'",
        )
      ).rows[0]
      assert.equal(customer.tax_id, 'RUC-NUEVO')
      await db.query('select public.create_document($1::jsonb)', [
        JSON.stringify({
          ...payload,
          requestId: crypto.randomUUID(),
          customerId: customer.id,
          tier: 'vip',
        }),
      ])
      assert.equal(
        (
          await db.query('select revision from public.customers where id=$1', [
            customer.id,
          ])
        ).rows[0].revision,
        2,
      )
      await assert.rejects(
        db.query('select public.save_customer($1)', [
          JSON.stringify({
            id: customer.id,
            revision: 1,
            name: customer.name,
            active: true,
            priceTier: 'emprendedor',
          }),
        ]),
        /Otro usuario/,
      )
    },
  )
  console.log(
    `${checks} PostgreSQL checks passed. No deployed database was accessed.`,
  )
} finally {
  await db.close()
}
