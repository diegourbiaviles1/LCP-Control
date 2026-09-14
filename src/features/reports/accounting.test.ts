import { describe, expect, it } from 'vitest'
import { accountingByMonth, accountingSummary, belowCostSales, catalogMargins, inventoryTurnover, marginRate, type AccountingSource, type ExpenseRecord, type PurchaseRecord } from './accounting'
import { accountingSheets } from './accountingExport'
import { idleStock, movementsInRange, type ReportDocument, type ReportSource } from './model'

const range = { from: '2026-09-01', to: '2026-09-30' }
const invoice: ReportDocument = {
  id: 'invoice', number: 'FAC-1', kind: 'invoice', createdAt: '2026-09-12T18:00:00Z',
  currency: 'NIO', total: 1150, tier: 'vip', paymentMethod: 'cash', location: 'store',
  customerId: 'customer', customerName: 'Cliente', items: [{ productId: 'p', description: 'Perfume', quantity: 2, lineTotal: 1150 }],
}
const purchase: PurchaseRecord = {
  id: 'purchase', requestId: 'request', productId: 'p', incurredOn: '2026-09-10', createdAt: '2026-09-10T18:00:00Z',
  location: 'warehouse', quantity: 10, unitPrice: 40, freightAmount: 20, taxAmount: 30, recoverableTaxAmount: 20,
  currency: 'NIO', exchangeRate: 1, supplier: 'Proveedor', reference: 'C1', note: 'Compra', landedUnitCostNio: 43,
}
const expense: ExpenseRecord = {
  id: 'expense', requestId: 'erequest', incurredOn: '2026-09-11', createdAt: '2026-09-11T18:00:00Z',
  category: 'servicios', description: 'Servicio', amount: 100, taxAmount: 15, recoverableTaxAmount: 5,
  currency: 'NIO', exchangeRate: 1, reference: 'G1', voidedAt: null, voidReason: null,
}
function source(accounting: Partial<AccountingSource> = {}): ReportSource {
  return {
    window: range, truncated: false, customers: [], documents: [structuredClone(invoice)], movements: [],
    inventory: [{ product: { id: 'p', barcode: 'P1', name: 'Perfume', brand: 'Marca', category: 'arabian', gender: 'unisex', size: 100, unit: 'ml', price: 575, currency: 'NIO', minimumStock: 2, active: true }, quantities: { warehouse: 3, store: 1 } }],
    accounting: {
      available: true, truncated: false,
      costs: [{ productId: 'p', averageCostNio: 999, updatedAt: '2026-09-15T18:00:00Z' }],
      purchases: [structuredClone(purchase)], expenses: [structuredClone(expense)],
      saleCosts: [{ documentId: 'invoice', productId: 'p', quantity: 2, unitCostNio: 200, netRevenueNio: 1000, taxNio: 150 }],
      movementCosts: [{ movementId: 'loss', productId: 'p', type: 'DAMAGED', quantity: 1, unitCostNio: 60, createdAt: '2026-09-12T18:00:00Z' }],
      ...accounting,
    },
  }
}

describe('contabilidad registrada', () => {
  it('congela costos históricos y separa compras, impuestos recuperables, gastos y mermas', () => {
    const result = accountingSummary(source(), range)
    expect(result).toMatchObject({
      revenueNio: 1000, salesTaxNio: 150, costOfSalesNio: 400, grossProfitNio: 600,
      expensesNio: 110, inventoryWriteOffNio: 60, netProfitNio: 430,
      purchasesNio: 430, purchaseTaxNio: 30, expenseTaxNio: 15, recoverableTaxNio: 25,
      inventoryCostNio: 3996, complete: true, coverage: 1,
    })
    expect(result.products[0].profitNio).toBe(600)
    expect(result.tiers[0].profitNio).toBe(600)
  })
  it('no usa precios de venta ni el promedio actual para llenar un costo histórico faltante', () => {
    const result = accountingSummary(source({ saleCosts: [] }), range)
    expect(result.missingCostUnits).toBe(2)
    expect(result.missingRevenueLines).toBe(1)
    expect(result.costOfSalesNio).toBe(0)
    expect(result.netProfitNio).toBeNull()
    expect(result.products[0].profitNio).toBeNull()
  })
  it('un costo cero explícito sí es un costo conocido', () => {
    const value = source()
    value.accounting!.saleCosts[0].unitCostNio = 0
    expect(accountingSummary(value, range)).toMatchObject({ complete: true, coverage: 1, grossProfitNio: 1000 })
  })
  it('usa la tasa guardada de cada compra y gasto, excluye gastos anulados', () => {
    const value = source({ purchases: [{ ...purchase, currency: 'USD', exchangeRate: 36.5 }], expenses: [
      { ...expense, currency: 'USD', exchangeRate: 36.5 },
      { ...expense, id: 'void', amount: 9999, voidedAt: '2026-09-13T18:00:00Z', voidReason: 'Duplicado' },
    ] })
    const totals = accountingSummary(value, range)
    expect(totals.purchasesNio).toBe(15695)
    expect(totals.expensesNio).toBe(4015)
    expect(totals.recoverableTaxNio).toBe(912.5)
  })
  it('no mezcla el periodo anterior con el periodo seleccionado y excluye proformas', () => {
    const value = source()
    value.documents.push({ ...invoice, id: 'old', createdAt: '2026-08-15T18:00:00Z' }, { ...invoice, id: 'quote', kind: 'proforma' })
    value.accounting!.purchases.push({ ...purchase, id: 'old', incurredOn: '2026-08-15' })
    value.accounting!.expenses.push({ ...expense, id: 'old', incurredOn: '2026-08-15' })
    const totals = accountingSummary(value, range)
    expect(totals.soldUnits).toBe(2)
    expect(totals.purchasesNio).toBe(430)
    expect(totals.expensesNio).toBe(110)
    expect(idleStock([{ ...invoice, kind: 'proforma' }], value.inventory, 'vip', 'NIO')).toHaveLength(1)
  })
  it('evita utilidades completas si la fuente está truncada o no se ha activado', () => {
    expect(accountingSummary(source({ truncated: true }), range).netProfitNio).toBeNull()
    expect(accountingSummary(source({ available: false }), range).netProfitNio).toBeNull()
    const value = source()
    value.truncated = true
    expect(accountingSummary(value, range).products[0].profitNio).toBeNull()
  })
  it('distingue ausencia de conteo o costo de inventario con saldo cero', () => {
    const value = source({ costs: [] })
    expect(accountingSummary(value, range)).toMatchObject({ inventoryCostNio: 0, unvaluedProducts: 1 })
    value.inventory[0].quantities = { warehouse: 0, store: 0 }
    expect(accountingSummary(value, range).unvaluedProducts).toBe(0)
    value.inventory[0].quantities.store = null
    expect(accountingSummary(value, range).unvaluedProducts).toBe(1)
  })
  it('una merma histórica sin costo impide cerrar el resultado operativo', () => {
    const value = source()
    value.movements.push({ id: 'legacy', type: 'DAMAGED', productId: 'p', quantity: 3, createdAt: '2026-09-11T03:00:00Z' })
    const totals = accountingSummary(value, range)
    expect(totals.missingWriteOffUnits).toBe(3)
    expect(totals.grossProfitNio).toBe(600)
    expect(totals.netProfitNio).toBeNull()
  })
  it('no duplica merma registrada ni resta traslados y ajustes positivos', () => {
    const value = source()
    value.movements.push(
      { id: 'loss', type: 'DAMAGED', productId: 'p', quantity: 1, createdAt: '2026-09-12T18:00:00Z' },
      { id: 'transfer', type: 'TRANSFER', productId: 'p', quantity: 2, createdAt: '2026-09-12T18:00:00Z' },
      { id: 'adjust', type: 'ADJUSTMENT', productId: 'p', quantity: 10, beforeQuantity: 5, afterQuantity: 10, createdAt: '2026-09-12T18:00:00Z' },
    )
    expect(accountingSummary(value, range)).toMatchObject({ inventoryWriteOffNio: 60, missingWriteOffUnits: 0, complete: true })
  })
  it('rechaza snapshots duplicados y cantidades inconsistentes sin generar ganancias ficticias', () => {
    const value = source()
    value.accounting!.saleCosts[0].quantity = 1
    expect(accountingSummary(value, range).netProfitNio).toBeNull()
    value.accounting!.saleCosts[0].quantity = 2
    value.accounting!.saleCosts.push({ ...value.accounting!.saleCosts[0] })
    expect(accountingSummary(value, range).netProfitNio).toBeNull()
  })
  it('un mes sin ventas sigue mostrando los gastos incurridos', () => {
    const value = source({ saleCosts: [], movementCosts: [] })
    value.documents = []
    const rows = accountingByMonth(value, { from: '2026-08-15', to: '2026-09-30' })
    expect(rows.map((row) => [row.month, row.totals.netProfitNio])).toEqual([['2026-08', 0], ['2026-09', -110]])
  })
  it('las exportaciones conservan celdas vacías para utilidad desconocida y auditoría de gastos', () => {
    const value = source({ saleCosts: [], expenses: [{ ...expense, voidedAt: '2026-09-13T18:00:00Z', voidReason: 'Duplicado' }] })
    const sheets = accountingSheets(value, range, 'Prueba')
    expect(sheets.find((sheet) => sheet.name === 'Estado de resultados')!.rows.find((row) => row[0] === 'Resultado operativo registrado')![1]).toBeNull()
    expect(sheets.find((sheet) => sheet.name === 'Gastos')!.rows[0].slice(-2)).toEqual(['Anulado', 'Duplicado'])
    expect(sheets.find((sheet) => sheet.name === 'Compras')!.rows[0][7]).toBe(40)
  })
  it('señala la venta bajo costo y no inventa pérdidas donde falta el costo', () => {
    expect(belowCostSales(source(), range)).toEqual([])
    const value = source()
    value.accounting!.saleCosts[0].unitCostNio = 600
    expect(belowCostSales(value, range)).toEqual([
      expect.objectContaining({ number: 'FAC-1', costNio: 1200, netRevenueNio: 1000, lossNio: 200 }),
    ])
    value.accounting!.saleCosts[0].unitCostNio = null
    expect(belowCostSales(value, range)).toEqual([])
  })
  it('la rotación queda pendiente mientras algún producto vendido o en existencia no tenga costo', () => {
    expect(inventoryTurnover(accountingSummary(source(), range), range)).toMatchObject({
      turnoverPerYear: 1.22, daysOnHand: 299.7,
    })
    const missing = accountingSummary(source({ costs: [] }), range)
    expect(inventoryTurnover(missing, range)).toMatchObject({ turnoverPerYear: null, daysOnHand: null })
  })
  it('el margen del catálogo compara el precio de lista con el costo promedio vigente', () => {
    expect(marginRate(1000, 250)).toBe(0.75)
    expect(marginRate(1000, null)).toBeNull()
    expect(marginRate(0, 250)).toBeNull()
    const value = source()
    value.inventory[0].product.prices = {
      emprendedor: { NIO: 2000, USD: 55 }, vip: { NIO: 1250, USD: 34 }, premium: { NIO: 800, USD: 22 },
    }
    expect(catalogMargins(value)).toEqual([
      { tier: 'emprendedor', priced: 1, belowCost: 0, medianMargin: 0.5005 },
      { tier: 'vip', priced: 1, belowCost: 0, medianMargin: 0.2008 },
      { tier: 'premium', priced: 1, belowCost: 1, medianMargin: -0.24875 },
    ])
  })
  it('el filtro de movimientos usa el día de Managua y excluye la ventana previa', () => {
    expect(movementsInRange([
      { productId: 'p', type: 'ENTRY', quantity: 3, createdAt: '2026-09-01T03:00:00Z' },
      { productId: 'p', type: 'ENTRY', quantity: 2, createdAt: '2026-10-01T03:00:00Z' },
    ], range).map((row) => row.quantity)).toEqual([2])
  })
})
