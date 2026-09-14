import type { Sheet } from '../../lib/xlsx'
import { priceTierLabels, productPrice } from '../../lib/pricing'
import { totalStock } from '../inventory/model'
import type { ReportRange, ReportSource } from './model'
import { accountingByMonth, accountingSummary, belowCostSales, catalogMargins, expenseCategories, expensesInRange, inventoryTurnover, marginRate, purchasesInRange, roundMoney } from './accounting'

export function accountingSheets(source: ReportSource, range: ReportRange, businessName: string): Sheet[] {
  const result = accountingSummary(source, range)
  const notes = [businessName, `Contabilidad del ${range.from} al ${range.to}. Importes contables en NIO.`,
    'Tipo de cambio guardado por operación. Promedio ponderado; costo histórico congelado al vender.',
    'Impuestos recuperables separados. Compras se reconocen como costo cuando se vende la mercadería.',
    result.complete ? 'Resultado operativo de las operaciones registradas; no es flujo de caja ni balance general.' : 'INCOMPLETO: faltan costos, tasas históricas o filas; no se calcula una utilidad total.',
    'El inventario es la existencia actual, no un saldo histórico al cierre del periodo.',
  ]
  if (!source.accounting?.available) return [{
    name: 'Contabilidad', notes,
    columns: [{ header: 'Estado', width: 85 }],
    rows: [['Todavía no hay una fuente contable disponible. Los precios de venta no son costos de compra.']],
  }]
  const costs = new Map(source.accounting.costs.map((row) => [row.productId, row.averageCostNio]))
  const turnover = inventoryTurnover(result, range)
  const losses = belowCostSales(source, range)
  const margins = catalogMargins(source)
  return [
    { name: 'Estado de resultados', notes,
      columns: [{ header: 'Concepto', width: 48 }, { header: 'Importe NIO', format: 'money', width: 22 }],
      rows: [
        ['Ventas sin impuesto (parte documentada)', result.revenueNio],
        ['Costo de ventas conocido', result.costOfSalesNio],
        ['Utilidad bruta', result.grossProfitNio],
        ['Gastos reconocidos', result.expensesNio],
        ['Mermas y salidas a costo conocido', result.inventoryWriteOffNio],
        ['Resultado operativo registrado', result.netProfitNio],
        ['Compras incorporadas al costo', result.purchasesNio],
        ['Impuesto incluido en ventas documentadas', result.salesTaxNio],
        ['Impuestos de compras', result.purchaseTaxNio],
        ['Impuestos de gastos', result.expenseTaxNio],
        ['Impuestos recuperables registrados', result.recoverableTaxNio],
        ['Inventario actual a costo conocido', result.inventoryCostNio],
        ['Rotación anual del inventario (veces)', turnover.turnoverPerYear],
        ['Días que dura el inventario', turnover.daysOnHand],
        ['Unidades vendidas sin costo', result.missingCostUnits],
        ['Renglones de venta sin base tributaria o cambiaria', result.missingRevenueLines],
        ['Unidades retiradas sin costo', result.missingWriteOffUnits],
        ['Productos sin valoración completa de inventario', result.unvaluedProducts],
      ],
    },
    { name: 'Compras', notes,
      columns: [
        { header: 'Fecha', width: 13 }, { header: 'Proveedor', width: 24 }, { header: 'Referencia', width: 24 },
        { header: 'Producto ID', width: 38 }, { header: 'Ubicación', width: 14 }, { header: 'Unidades', format: 'integer', width: 12 },
        { header: 'Moneda', width: 10 }, { header: 'Precio compra unitario', format: 'money', width: 22 },
        { header: 'Flete total', format: 'money', width: 15 }, { header: 'Impuestos total', format: 'money', width: 17 },
        { header: 'Impuesto recuperable', format: 'money', width: 22 }, { header: 'TC NIO por unidad', format: 'number', width: 20 },
        { header: 'Costo unitario puesto NIO', format: 'number', width: 25 }, { header: 'Registrado el', width: 25 },
      ],
      rows: purchasesInRange(source, range).map((row) => [row.incurredOn, row.supplier, row.reference, row.productId,
        row.location, row.quantity, row.currency, row.unitPrice, row.freightAmount, row.taxAmount, row.recoverableTaxAmount,
        row.exchangeRate, row.landedUnitCostNio, row.createdAt]),
    },
    { name: 'Gastos', notes,
      columns: [
        { header: 'Fecha', width: 13 }, { header: 'Categoría', width: 20 }, { header: 'Descripción', width: 40 },
        { header: 'Referencia', width: 24 }, { header: 'Moneda', width: 10 }, { header: 'Base', format: 'money', width: 16 },
        { header: 'Impuestos', format: 'money', width: 16 }, { header: 'Impuesto recuperable', format: 'money', width: 22 },
        { header: 'TC NIO por unidad', format: 'number', width: 20 }, { header: 'Gasto reconocido NIO', format: 'money', width: 23 },
        { header: 'Estado', width: 14 }, { header: 'Motivo anulación', width: 40 },
      ],
      rows: expensesInRange(source, range).map((row) => [row.incurredOn, expenseCategories[row.category], row.description,
        row.reference, row.currency, row.amount, row.taxAmount, row.recoverableTaxAmount, row.exchangeRate,
        row.voidedAt ? 0 : roundMoney((row.amount + row.taxAmount - row.recoverableTaxAmount) * row.exchangeRate),
        row.voidedAt ? 'Anulado' : 'Vigente', row.voidReason]),
    },
    { name: 'Costos y precios', notes: [...notes, 'Precios de catálogo actuales. El margen real descuenta el impuesto configurado en cada venta.'],
      columns: [
        { header: 'Código', width: 20 }, { header: 'Producto', width: 38 }, { header: 'Existencias actuales', format: 'integer', width: 22 },
        { header: 'Costo promedio NIO', format: 'number', width: 22 }, { header: 'Inventario a costo NIO', format: 'money', width: 24 },
        { header: 'Emprendedor NIO', format: 'money', width: 20 }, { header: 'VIP NIO', format: 'money', width: 18 }, { header: 'Premium NIO', format: 'money', width: 18 },
        { header: 'Emprendedor USD', format: 'money', width: 20 }, { header: 'VIP USD', format: 'money', width: 18 }, { header: 'Premium USD', format: 'money', width: 18 },
        { header: 'Margen Emprendedor %', format: 'number', width: 24 }, { header: 'Margen VIP %', format: 'number', width: 18 }, { header: 'Margen Premium %', format: 'number', width: 22 },
      ],
      rows: source.inventory.map((item) => {
        const stock = totalStock(item)
        const cost = costs.get(item.product.id) ?? null
        return [item.product.barcode, `${item.product.brand} · ${item.product.name}`, stock, cost,
          stock !== null && cost !== null ? roundMoney(stock * cost) : null,
          ...(['NIO', 'USD'] as const).flatMap((currency) => (['emprendedor', 'vip', 'premium'] as const).map((tier) => productPrice(item.product, tier, currency))),
          ...(['emprendedor', 'vip', 'premium'] as const).map((tier) => {
            const rate = marginRate(productPrice(item.product, tier, 'NIO'), cost)
            return rate === null ? null : roundMoney(rate * 100)
          })]
      }),
    },
    { name: 'Ventas bajo costo', notes: [...notes, 'Sólo renglones con costo y venta neta registrados. Un costo desconocido no se cuenta como pérdida.'],
      columns: [
        { header: 'Documento', width: 16 }, { header: 'Fecha', width: 25 }, { header: 'Producto', width: 40 },
        { header: 'Unidades', format: 'integer', width: 12 }, { header: 'Venta neta NIO', format: 'money', width: 20 },
        { header: 'Costo NIO', format: 'money', width: 18 }, { header: 'Pérdida NIO', format: 'money', width: 18 },
      ],
      rows: losses.map((row) => [row.number, row.createdAt, row.description, row.quantity, row.netRevenueNio, row.costNio, row.lossNio]),
    },
    { name: 'Margen del catálogo', notes: [...notes, 'Margen que deja hoy cada lista sobre el costo promedio vigente, sin descontar impuesto.'],
      columns: [{ header: 'Lista', width: 22 }, { header: 'Productos con costo y precio', format: 'integer', width: 30 },
        { header: 'Margen mediano %', format: 'number', width: 20 }, { header: 'Productos bajo costo', format: 'integer', width: 24 }],
      rows: margins.map((row) => [priceTierLabels[row.tier], row.priced,
        row.medianMargin === null ? null : roundMoney(row.medianMargin * 100), row.belowCost]),
    },
    { name: 'Rentabilidad productos', notes,
      columns: [
        { header: 'Producto', width: 40 }, { header: 'Unidades', format: 'integer', width: 12 },
        { header: 'Venta neta NIO conocida', format: 'money', width: 25 }, { header: 'Costo NIO conocido', format: 'money', width: 23 },
        { header: 'Utilidad bruta NIO', format: 'money', width: 22 }, { header: 'Unidades sin datos', format: 'integer', width: 22 },
      ],
      rows: result.products.map((row) => [row.description, row.quantity, row.netRevenueNio, row.costNio, row.profitNio, row.missingUnits]),
    },
    { name: 'Rentabilidad listas', notes,
      columns: [{ header: 'Lista', width: 22 }, { header: 'Venta neta NIO conocida', format: 'money', width: 25 },
        { header: 'Costo NIO conocido', format: 'money', width: 23 }, { header: 'Utilidad bruta NIO', format: 'money', width: 22 },
        { header: 'Unidades sin datos', format: 'integer', width: 22 }],
      rows: result.tiers.map((row) => [row.tier, row.netRevenueNio, row.costNio, row.profitNio, row.missingUnits]),
    },
    { name: 'Evolución mensual', notes,
      columns: [{ header: 'Mes', width: 13 }, { header: 'Venta neta NIO conocida', format: 'money', width: 25 },
        { header: 'Costo de ventas NIO conocido', format: 'money', width: 29 }, { header: 'Gastos NIO', format: 'money', width: 20 },
        { header: 'Mermas y salidas NIO conocidas', format: 'money', width: 31 }, { header: 'Resultado operativo NIO', format: 'money', width: 27 }],
      rows: accountingByMonth(source, range).map(({ month, totals }) => [month, totals.revenueNio, totals.costOfSalesNio, totals.expensesNio, totals.inventoryWriteOffNio, totals.netProfitNio]),
    },
  ]
}
