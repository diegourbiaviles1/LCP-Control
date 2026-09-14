import type { Currency, InventoryLocation, PriceTier } from '../../lib/domain'
import { productPrice } from '../../lib/pricing'
import { daysBetween, inRange, localDay, movementsInRange, type ReportRange, type ReportSource } from './model'
import { totalStock } from '../inventory/model'

/** Accounting values use NIO; every USD transaction carries its own saved rate. */

/**
 * La mercadería entra por agencia de envíos: una caja con varios perfumes donde
 * lo único que se paga aparte del proveedor es el peso del paquete. Por eso un
 * pedido tiene un solo costo de envío y tantos renglones como perfumes traiga,
 * cada uno con su precio original ya negociado.
 */
export interface ShipmentLineInput {
  productId: string
  location: InventoryLocation
  quantity: number
  unitPrice: number
}
export interface ShipmentInput {
  requestId: string
  incurredOn: string
  /** A quién se le compró la mercadería. */
  supplier: string
  /** Agencia que cobró el peso del paquete. */
  agency: string
  reference: string
  note: string
  currency: Currency
  exchangeRate: number
  /** Lo que cobró la agencia por el peso de todo el pedido. */
  shippingAmount: number
  lines: ShipmentLineInput[]
}
export interface OpeningCostInput {
  requestId: string
  productId: string
  unitCost: number
  currency: Currency
  exchangeRate: number
  note: string
}
/**
 * Las cinco cuentas de gasto del negocio, en el orden en que las lleva el dueño.
 * Sólo tres bajan la utilidad:
 *
 * - `result`: gasto del período; resta del resultado operativo.
 * - `financing`: devolución de capital. Pagar una cuota no empobrece al negocio,
 *   sólo mueve el dinero de un bolsillo a otro; lo que cuesta el préstamo es su
 *   interés, y ése vive en gastos financieros. Se muestra, no resta.
 * - `inventory`: la mercadería y su flete ya están registrados en los pedidos y
 *   pesan en el resultado cuando se vende cada perfume, no cuando llega la caja.
 *   La cuenta se llena sola desde los pedidos y nadie la teclea.
 */
export const expenseAccounts = {
  impuestos: { label: 'Impuestos y tasas', effect: 'result' },
  prestamos: { label: 'Pago de préstamos', effect: 'financing' },
  financieros: { label: 'Gastos financieros', effect: 'result' },
  ventas: { label: 'Gastos de ventas', effect: 'result' },
  operativos: { label: 'Gastos operativos', effect: 'inventory' },
} as const
export type ExpenseAccount = keyof typeof expenseAccounts
export const expenseAccountOrder = Object.keys(expenseAccounts) as ExpenseAccount[]

/** Categorías que se teclean. Ninguna pertenece a gastos operativos. */
export const expenseCategories = {
  impuestos_dgi: { account: 'impuestos', label: 'Impuestos DGI' },
  impuestos_alma: { account: 'impuestos', label: 'Impuestos ALMA' },
  prestamo_acreedor: { account: 'prestamos', label: 'Acreedores' },
  prestamo_bancario: { account: 'prestamos', label: 'Bancarios' },
  interes_bancario: { account: 'financieros', label: 'Intereses bancarios' },
  interes_acreedor: { account: 'financieros', label: 'Intereses de acreedor' },
  renta: { account: 'ventas', label: 'Renta' },
  salario: { account: 'ventas', label: 'Salario' },
  papeleria: { account: 'ventas', label: 'Papelería y artículos de oficina' },
  combustible: { account: 'ventas', label: 'Combustible' },
  agua_luz: { account: 'ventas', label: 'Agua y luz' },
  internet: { account: 'ventas', label: 'Servicio de internet' },
  limpieza: { account: 'ventas', label: 'Artículos de limpieza' },
  mobiliario: { account: 'ventas', label: 'Muebles y equipos electrónicos' },
  viatico: { account: 'ventas', label: 'Viático' },
  marketing: { account: 'ventas', label: 'Marketing y publicidad' },
} as const satisfies Record<string, { account: ExpenseAccount; label: string }>
export type ExpenseCategory = keyof typeof expenseCategories
export const expenseCategoryOrder = Object.keys(expenseCategories) as ExpenseCategory[]
export const categoriesOf = (account: ExpenseAccount) =>
  expenseCategoryOrder.filter((category) => expenseCategories[category].account === account)
export const expenseLabel = (category: ExpenseCategory) => expenseCategories[category].label
export const accountOf = (category: ExpenseCategory): ExpenseAccount => expenseCategories[category].account
/** Renglones de gastos operativos: no son filas tecleadas, salen de los pedidos. */
export const operatingLines = { goods: 'Compra de mercadería', shipping: 'Flete de importación' } as const
export interface ExpenseInput {
  requestId: string
  incurredOn: string
  category: ExpenseCategory
  description: string
  amount: number
  currency: Currency
  exchangeRate: number
  reference: string
}
export interface ShipmentLine extends ShipmentLineInput {
  id: string
  /** Precio original del renglón, sin el envío. */
  goodsAmount: number
  /** Parte del peso que le tocó a este renglón, en la moneda del pedido. */
  shippingShare: number
  /** Precio original más su parte del envío, ya en córdobas. */
  landedUnitCostNio: number
}
export interface ShipmentRecord extends Omit<ShipmentInput, 'lines'> {
  id: string
  createdAt: string
  units: number
  goodsAmount: number
  shippingPerUnit: number
  lines: ShipmentLine[]
}
export interface ExpenseRecord extends ExpenseInput {
  id: string
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
}
export interface AverageCost {
  productId: string
  averageCostNio: number | null
  updatedAt: string
}
export interface SaleCostSnapshot {
  documentId: string
  productId: string
  quantity: number
  unitCostNio: number | null
  netRevenueNio: number | null
  taxNio: number | null
}
export interface AccountingSource {
  available: boolean
  costs: AverageCost[]
  shipments: ShipmentRecord[]
  expenses: ExpenseRecord[]
  saleCosts: SaleCostSnapshot[]
  movementCosts?: { movementId: string; productId: string; type: string; quantity: number; unitCostNio: number | null; createdAt: string }[]
  truncated: boolean
}
export const emptyAccounting: AccountingSource = {
  available: false, costs: [], shipments: [], expenses: [], saleCosts: [], truncated: false,
}
export interface ProductMargin {
  productId: string
  description: string
  quantity: number
  netRevenueNio: number
  costNio: number
  profitNio: number | null
  missingUnits: number
}
export interface AccountingSummary {
  revenueNio: number
  salesTaxNio: number
  costOfSalesNio: number
  grossProfitNio: number | null
  /** Sólo lo que resta del resultado: ventas, impuestos y gastos financieros. */
  expensesNio: number
  /** Capital devuelto a bancos y acreedores. Se informa, no resta. */
  loanPaymentsNio: number
  inventoryWriteOffNio: number
  missingWriteOffUnits: number
  netProfitNio: number | null
  /** Mercadería más envío de los pedidos del período, en córdobas. */
  purchasesNio: number
  /** Sólo el precio original de los perfumes pedidos. */
  purchaseGoodsNio: number
  /** Sólo lo que cobraron las agencias por el peso. */
  purchaseShippingNio: number
  purchasedUnits: number
  inventoryCostNio: number
  missingCostUnits: number
  missingRevenueLines: number
  unvaluedProducts: number
  soldUnits: number
  coverage: number | null
  complete: boolean
  products: ProductMargin[]
  tiers: { tier: PriceTier; netRevenueNio: number; costNio: number; profitNio: number | null; missingUnits: number }[]
  expenseGroups: { category: ExpenseCategory; amountNio: number }[]
  /** Las cinco cuentas en su orden, con lo que juntó cada una en el período. */
  expenseByAccount: { account: ExpenseAccount; amountNio: number; deducts: boolean }[]
}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const known = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value) && value >= 0
export const datedInRange = (day: string, range: ReportRange) => day >= range.from && day <= range.to

export function shipmentsInRange(source: ReportSource, range: ReportRange) {
  return (source.accounting?.shipments ?? []).filter((row) => datedInRange(row.incurredOn, range))
}
export function expensesInRange(source: ReportSource, range: ReportRange) {
  return (source.accounting?.expenses ?? []).filter((row) => datedInRange(row.incurredOn, range))
}

/**
 * A frozen snapshot is only trusted when it is the single row for its invoice
 * line and still matches the quantity invoiced. Anything else is treated as
 * missing, never as a zero cost.
 */
function snapshotIndex(accounting: AccountingSource) {
  const rows = new Map<string, SaleCostSnapshot>()
  const duplicates = new Set<string>()
  for (const row of accounting.saleCosts) {
    const key = `${row.documentId}:${row.productId}`
    if (rows.has(key)) duplicates.add(key)
    rows.set(key, row)
  }
  return (documentId: string, productId: string, quantity: number) => {
    const key = `${documentId}:${productId}`
    const row = rows.get(key)
    return row && !duplicates.has(key) && row.quantity === quantity ? row : null
  }
}

/** Missing historical cost is never replaced by the current average or a selling price. */
export function accountingSummary(source: ReportSource, range: ReportRange): AccountingSummary {
  const accounting = source.accounting ?? emptyAccounting
  const result: AccountingSummary = {
    revenueNio: 0, salesTaxNio: 0, costOfSalesNio: 0, grossProfitNio: null,
    expensesNio: 0, loanPaymentsNio: 0, inventoryWriteOffNio: 0, missingWriteOffUnits: 0,
    netProfitNio: null, purchasesNio: 0, purchaseGoodsNio: 0,
    purchaseShippingNio: 0, purchasedUnits: 0, inventoryCostNio: 0,
    missingCostUnits: 0, missingRevenueLines: 0, unvaluedProducts: 0,
    soldUnits: 0, coverage: null, complete: false, products: [], tiers: [],
    expenseGroups: [], expenseByAccount: [],
  }
  const snapshot = snapshotIndex(accounting)
  const products = new Map<string, ProductMargin>()
  const tiers = new Map<PriceTier, AccountingSummary['tiers'][number]>()
  for (const document of inRange(source.documents, range).filter((row) => row.kind === 'invoice')) {
    const tier = tiers.get(document.tier) ?? {
      tier: document.tier, netRevenueNio: 0, costNio: 0, profitNio: 0, missingUnits: 0,
    }
    for (const item of document.items) {
      const row = snapshot(document.id, item.productId, item.quantity)
      const costKnown = !!row && known(row.unitCostNio)
      const revenueKnown = !!row && known(row.netRevenueNio) && known(row.taxNio)
      const product = products.get(item.productId) ?? {
        productId: item.productId, description: item.description, quantity: 0,
        netRevenueNio: 0, costNio: 0, profitNio: 0, missingUnits: 0,
      }
      result.soldUnits += item.quantity
      product.quantity += item.quantity
      if (costKnown) {
        const cost = roundMoney(row.unitCostNio! * item.quantity)
        result.costOfSalesNio += cost
        product.costNio += cost
        tier.costNio += cost
      } else result.missingCostUnits += item.quantity
      if (revenueKnown) {
        result.revenueNio += row.netRevenueNio!
        result.salesTaxNio += row.taxNio!
        product.netRevenueNio += row.netRevenueNio!
        tier.netRevenueNio += row.netRevenueNio!
      } else result.missingRevenueLines++
      if (!costKnown || !revenueKnown) {
        product.missingUnits += item.quantity
        tier.missingUnits += item.quantity
      }
      products.set(item.productId, product)
    }
    tiers.set(document.tier, tier)
  }
  for (const row of shipmentsInRange(source, range)) {
    result.purchaseGoodsNio += roundMoney(row.goodsAmount * row.exchangeRate)
    result.purchaseShippingNio += roundMoney(row.shippingAmount * row.exchangeRate)
    result.purchasedUnits += row.units
  }
  const groups = new Map<ExpenseCategory, number>()
  const accounts = new Map<ExpenseAccount, number>()
  for (const row of expensesInRange(source, range).filter((entry) => !entry.voidedAt)) {
    const amount = roundMoney(row.amount * row.exchangeRate)
    const account = expenseCategories[row.category]?.account
    // Una categoría que la aplicación ya no conoce no se suma a ninguna cuenta:
    // antes que repartirla a ojo, queda fuera y se ve en el historial.
    if (!account) continue
    const effect = expenseAccounts[account].effect
    if (effect === 'result') result.expensesNio += amount
    else if (effect === 'financing') result.loanPaymentsNio += amount
    groups.set(row.category, (groups.get(row.category) ?? 0) + amount)
    accounts.set(account, (accounts.get(account) ?? 0) + amount)
  }
  for (const row of accounting.movementCosts ?? []) {
    if (!datedInRange(localDay(row.createdAt), range)) continue
    if (known(row.unitCostNio)) result.inventoryWriteOffNio += roundMoney(row.quantity * row.unitCostNio)
    else result.missingWriteOffUnits += row.quantity
  }
  const costedMovements = new Set((accounting.movementCosts ?? []).map((row) => row.movementId))
  for (const row of movementsInRange(source.movements, range)) {
    if (row.id && costedMovements.has(row.id)) continue
    if (row.type === 'DAMAGED' || row.type === 'EXIT') result.missingWriteOffUnits += Math.abs(row.quantity)
    else if (row.type === 'ADJUSTMENT' && row.beforeQuantity != null && row.afterQuantity != null)
      result.missingWriteOffUnits += Math.max(0, row.beforeQuantity - row.afterQuantity)
  }
  const costByProduct = new Map(accounting.costs.map((row) => [row.productId, row.averageCostNio]))
  for (const item of source.inventory) {
    const stock = totalStock(item)
    const cost = costByProduct.get(item.product.id)
    if (stock === 0) continue
    if (stock === null || !known(cost)) result.unvaluedProducts++
    else result.inventoryCostNio += roundMoney(stock * cost)
  }
  const reliable = accounting.available && !source.truncated && !accounting.truncated
  result.complete = reliable && !result.missingCostUnits && !result.missingRevenueLines && !result.missingWriteOffUnits
  const grossComplete = reliable && !result.missingCostUnits && !result.missingRevenueLines
  result.revenueNio = roundMoney(result.revenueNio)
  result.salesTaxNio = roundMoney(result.salesTaxNio)
  result.costOfSalesNio = roundMoney(result.costOfSalesNio)
  result.expensesNio = roundMoney(result.expensesNio)
  result.loanPaymentsNio = roundMoney(result.loanPaymentsNio)
  result.inventoryWriteOffNio = roundMoney(result.inventoryWriteOffNio)
  result.purchaseGoodsNio = roundMoney(result.purchaseGoodsNio)
  result.purchaseShippingNio = roundMoney(result.purchaseShippingNio)
  result.purchasesNio = roundMoney(result.purchaseGoodsNio + result.purchaseShippingNio)
  result.inventoryCostNio = roundMoney(result.inventoryCostNio)
  result.grossProfitNio = grossComplete ? roundMoney(result.revenueNio - result.costOfSalesNio) : null
  result.netProfitNio = result.complete ? roundMoney(result.revenueNio - result.costOfSalesNio - result.expensesNio - result.inventoryWriteOffNio) : null
  result.coverage = result.soldUnits ? (result.soldUnits - result.missingCostUnits) / result.soldUnits : null
  result.products = [...products.values()].map((row) => ({
    ...row, netRevenueNio: roundMoney(row.netRevenueNio), costNio: roundMoney(row.costNio),
    profitNio: reliable && !row.missingUnits ? roundMoney(row.netRevenueNio - row.costNio) : null,
  })).sort((a, b) => (b.profitNio ?? -Infinity) - (a.profitNio ?? -Infinity))
  result.tiers = [...tiers.values()].map((row) => ({
    ...row, netRevenueNio: roundMoney(row.netRevenueNio), costNio: roundMoney(row.costNio),
    profitNio: reliable && !row.missingUnits ? roundMoney(row.netRevenueNio - row.costNio) : null,
  }))
  result.expenseGroups = expenseCategoryOrder
    .filter((category) => groups.has(category))
    .map((category) => ({ category, amountNio: roundMoney(groups.get(category)!) }))
  // La cuenta de gastos operativos no se teclea: es lo que costó traer los
  // pedidos del período, mercadería y flete de la agencia.
  result.expenseByAccount = expenseAccountOrder.map((account) => ({
    account,
    amountNio: account === 'operativos' ? result.purchasesNio : roundMoney(accounts.get(account) ?? 0),
    deducts: expenseAccounts[account].effect === 'result',
  }))
  return result
}

export interface BelowCostSale {
  documentId: string
  number: string
  createdAt: string
  productId: string
  description: string
  quantity: number
  netRevenueNio: number
  costNio: number
  lossNio: number
}
/**
 * Sales invoiced under their own frozen cost. A line is only listed when both
 * halves are known: an unknown cost is a gap in the record, not a loss.
 */
export function belowCostSales(source: ReportSource, range: ReportRange): BelowCostSale[] {
  const snapshot = snapshotIndex(source.accounting ?? emptyAccounting)
  const rows: BelowCostSale[] = []
  for (const document of inRange(source.documents, range).filter((row) => row.kind === 'invoice'))
    for (const item of document.items) {
      const row = snapshot(document.id, item.productId, item.quantity)
      if (!row || !known(row.unitCostNio) || !known(row.netRevenueNio)) continue
      const costNio = roundMoney(row.unitCostNio * item.quantity)
      if (costNio <= row.netRevenueNio) continue
      rows.push({
        documentId: document.id, number: document.number, createdAt: document.createdAt,
        productId: item.productId, description: item.description, quantity: item.quantity,
        netRevenueNio: roundMoney(row.netRevenueNio), costNio, lossNio: roundMoney(costNio - row.netRevenueNio),
      })
    }
  return rows.sort((a, b) => b.lossNio - a.lossNio)
}

export interface Turnover {
  turnoverPerYear: number | null
  daysOnHand: number | null
  costOfSalesNio: number
  inventoryCostNio: number
}
/**
 * Rotation compares the cost sold during the period against the stock valued
 * today. It stays blank while any sold unit or any product in stock lacks a
 * cost, because a partial numerator over a partial denominator invents a ratio.
 */
export function inventoryTurnover(summary: AccountingSummary, range: ReportRange): Turnover {
  const days = Math.max(1, daysBetween(range.from, range.to) + 1)
  const perDay = summary.costOfSalesNio / days
  const usable =
    summary.inventoryCostNio > 0 && !summary.missingCostUnits && !summary.unvaluedProducts
  return {
    turnoverPerYear: usable ? roundMoney((perDay * 365) / summary.inventoryCostNio) : null,
    daysOnHand: usable && perDay > 0 ? roundMoney(summary.inventoryCostNio / perDay) : null,
    costOfSalesNio: summary.costOfSalesNio,
    inventoryCostNio: summary.inventoryCostNio,
  }
}

/** Share of the list price that is not cost. Null whenever either side is unknown. */
export function marginRate(priceNio: number | null, costNio: number | null | undefined) {
  if (priceNio === null || priceNio <= 0 || !known(costNio)) return null
  return (priceNio - costNio) / priceNio
}
export interface CatalogMargin {
  tier: PriceTier
  priced: number
  belowCost: number
  medianMargin: number | null
}
/**
 * Margin each price list leaves over the current average cost, across the
 * catalogue. The median, not the average, so one mispriced perfume does not
 * move the figure for the other 259.
 */
export function catalogMargins(source: ReportSource): CatalogMargin[] {
  const costs = new Map(
    (source.accounting ?? emptyAccounting).costs.map((row) => [row.productId, row.averageCostNio]),
  )
  return (['emprendedor', 'vip', 'premium'] as const).map((tier) => {
    const rates: number[] = []
    let belowCost = 0
    for (const item of source.inventory) {
      const rate = marginRate(productPrice(item.product, tier, 'NIO'), costs.get(item.product.id))
      if (rate === null) continue
      rates.push(rate)
      if (rate < 0) belowCost++
    }
    rates.sort((a, b) => a - b)
    const middle = Math.floor(rates.length / 2)
    return {
      tier, priced: rates.length, belowCost,
      medianMargin: rates.length
        ? rates.length % 2
          ? rates[middle]
          : (rates[middle - 1] + rates[middle]) / 2
        : null,
    }
  })
}

/** Calendar months clipped to the selected period, using the same ledger calculation. */
export function accountingByMonth(source: ReportSource, range: ReportRange) {
  const rows: { month: string; totals: AccountingSummary }[] = []
  let month = `${range.from.slice(0, 7)}-01`
  for (let i = 0; month <= range.to && i < 14; i++) {
    const next = new Date(`${month}T12:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    const nextMonth = next.toISOString().slice(0, 10)
    const end = new Date(next.getTime() - 86400000).toISOString().slice(0, 10)
    rows.push({ month: month.slice(0, 7), totals: accountingSummary(source, {
      from: month < range.from ? range.from : month,
      to: end > range.to ? range.to : end,
    }) })
    month = nextMonth
  }
  return rows
}
