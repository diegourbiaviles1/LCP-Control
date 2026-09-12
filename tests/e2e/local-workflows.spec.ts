import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.route('https://drive.google.com/**', (route) => route.abort())
})
test('catalog categories, variant filters, unavailable photos and internal barcode', async ({
  page,
}, info) => {
  await page.goto('/demo/products')
  await page.getByLabel('Categoría', { exact: true }).selectOption('niche')
  await expect(page.getByText('1 de 260 productos')).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByLabel('Marca', { exact: true }).selectOption('Rasasi')
  await expect(page.getByText('16 de 260 productos')).toBeVisible()
  await page.getByLabel('Buscar producto').fill('Hawas black')
  await page.getByLabel('Moneda', { exact: true }).selectOption('USD')
  await page.getByLabel('Lista de precios').selectOption('premium')
  await expect(page.locator('.catalog-price')).toContainText('30.00')
  await expect(page.getByText('Foto no disponible')).toBeVisible()
  await page
    .getByRole('button', { name: 'Ver Hawas black', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Código de fabricante: pendiente de registrar',
  )
  await expect(
    page.getByRole('img', { name: 'Código interno LCP-B106BB7E6C' }),
  ).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar etiqueta' }).click()
  expect((await download).suggestedFilename()).toBe('LCP-B106BB7E6C.svg')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByLabel('Tamaño', { exact: true }).selectOption('unknown')
  await expect(page.getByText('4 de 260 productos')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: `test-results/catalog-${info.project.name}.png`,
    fullPage: true,
  })
})
test('invoice recalculates every tier and currency, saves and reopens a draft', async ({
  page,
}, info) => {
  await page.goto('/demo/sales')
  await page.getByLabel('Cliente', { exact: true }).fill('Cliente de prueba')
  await page.getByLabel('Producto para facturar').selectOption('lcp-b106bb7e6c')
  await page.getByRole('button', { name: 'Agregar al borrador' }).click()
  await page.getByLabel('Cantidad de Rasasi Hawas black').fill('3')
  await expect(page.locator('.invoice-total')).toContainText('3,885.00')
  await page.getByLabel('Moneda', { exact: true }).selectOption('USD')
  await expect(page.locator('.invoice-total')).toContainText('105.00')
  await page.getByLabel('Lista de precios').selectOption('premium')
  await expect(page.locator('.invoice-total')).toContainText('90.00')
  await page.getByLabel('Moneda', { exact: true }).selectOption('NIO')
  await expect(page.locator('.invoice-total')).toContainText('3,330.00')
  await page.getByLabel('Cantidad de Rasasi Hawas black').fill('0')
  await expect(
    page.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeDisabled()
  await page.getByLabel('Cantidad de Rasasi Hawas black').fill('3')
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado')
  await page.reload()
  await page.locator('.saved-drafts button').click()
  await expect(page.getByLabel('Cliente', { exact: true })).toHaveValue(
    'Cliente de prueba',
  )
  await expect(page.locator('.invoice-total')).toContainText('3,330.00')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: `test-results/invoice-${info.project.name}.png`,
    fullPage: true,
  })
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.invoice-notice')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Facturación', exact: true }),
  ).not.toBeVisible()
  await page.screenshot({
    path: `test-results/invoice-print-${info.project.name}.png`,
    fullPage: true,
  })
})
test('supplier registration and edits survive refresh', async ({
  page,
}, info) => {
  await page.goto('/demo/suppliers')
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
  await page.getByLabel('Empresa o nombre').fill('Distribuidora de prueba')
  await page.getByLabel('Persona de contacto').fill('Contacto de prueba')
  await page.getByLabel('Teléfono / WhatsApp').fill('8888-0000')
  await page.getByLabel('Correo electrónico').fill('proveedor@example.com')
  await page.getByRole('button', { name: 'Guardar proveedor' }).click()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Distribuidora de prueba' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Editar Distribuidora de prueba' })
    .click()
  await page
    .getByLabel('Condiciones de pago y entrega')
    .fill('Entrega por confirmar')
  await page.getByRole('button', { name: 'Guardar proveedor' }).click()
  await expect(page.getByText('Entrega por confirmar')).toBeVisible()
  await expect(page.locator('.supplier-card')).toHaveCount(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: `test-results/suppliers-${info.project.name}.png`,
    fullPage: true,
  })
})
test('entry, exit and damage are pending drafts and never change stock', async ({
  page,
}) => {
  await page.goto('/demo/inventory')
  for (const title of ['Entrada', 'Salida', 'Dañado']) {
    await page.getByRole('button', { name: title, exact: true }).click()
    await page
      .getByLabel('Producto del movimiento')
      .selectOption('lcp-b106bb7e6c')
    await page.getByLabel('Cantidad', { exact: true }).fill('2')
    await page
      .getByLabel(
        title === 'Entrada' ? 'Proveedor o motivo de la entrada' : 'Motivo',
        { exact: true },
      )
      .fill('Prueba del formulario')
    await page
      .getByRole('button', { name: 'Guardar movimiento pendiente' })
      .click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  }
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Movimientos pendientes (3)' }),
  ).toBeVisible()
  await page.getByLabel('Existencias', { exact: true }).selectOption('unknown')
  await expect(page.getByText('260 de 260 productos')).toBeVisible()
})
test('a new visit rotates the reflection without consuming two entries in StrictMode', async ({
  page,
}) => {
  await page.goto('/demo')
  const first = await page.locator('blockquote').innerText()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('lcp.reflections.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  await page.reload()
  await expect(page.locator('blockquote')).not.toHaveText(first)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('lcp.reflections.v1') ?? '[]').length,
      ),
    )
    .toBe(2)
})
